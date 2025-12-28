import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface AllowedCommand {
  command: string;
  allowedArgs?: (string | RegExp)[];
  deniedArgs?: (string | RegExp)[];
}

// Default configuration
const DEFAULT_ALLOWED_COMMANDS: AllowedCommand[] = [
  // Read-only commands
  { command: "ls" },
  { command: "cat" },
  { command: "echo" },
  { command: "pwd" },
  { command: "whoami" },
  { command: "date" },
  { command: "grep" },
  { command: "find" },
  { command: "head" },
  { command: "tail" },
  { command: "wc" },
  { command: "du" },
  { command: "df" },
  { command: "which" },
  
  // File operations
  { command: "mkdir" },
  { command: "touch" },
  { command: "cp" }, 
  
  // Package Managers
  { command: "npm", 
    allowedArgs: [
      "install", "i", "ci",
      "run", "test", "start", "build", "dev", "lint", "format",
      "init", "create",
      "list", "ls",
      "view", "search", "info", "audit", "fund", "doctor",
      "version", "v",
      /^["\w@/.-]+$/,
      /^-/,
    ],
    deniedArgs: ["publish", "unpublish", "login", "logout", "adduser", "owner", "team", "token", "whoami", "eval", "exec"]
  },
  { command: "yarn",
    allowedArgs: [
      "install", "add", "remove",
      "run", "test", "start", "build", "dev", "lint", "format",
      "init", "create",
      "list", "info", "audit", "why",
      "version", "-v", "--version",
      /^["\w@/.-]+$/,
      /^-/,
    ],
    deniedArgs: ["publish", "login", "logout", "owner", "team", "whoami", "exec", "node"]
  },
  { command: "pnpm",
    allowedArgs: [
      "install", "i", "add", "remove",
      "run", "test", "start", "build", "dev", "lint", "format",
      "init", "create",
      "list", "ls", "info", "audit", "why", "store",
      "version", "-v", "--version",
      /^["\w@/.-]+$/,
      /^-/,
    ],
    deniedArgs: ["publish", "login", "logout", "server", "exec", "dlx"]
  },

  // Development Tools
  { command: "tsc" },
  
  // Git
  { command: "git", allowedArgs: [
    "status", "log", "diff", "show", "branch", "tag",
    "checkout", "switch", "add", "commit", "push", "pull", "fetch",
    "clone", "init", "remote", "config",
    "stash", "merge", "rebase", "reset", "restore",
    "clean", "blame", "grep",
    /^["\w@/.-]+$/,
    /^-/,
    /^'[^']*'$/,
    /^"[^"]*"$/,
  ]},
  
  // Mobile Development
  { command: "pod" },
  { command: "xcodebuild" },
  { command: "fastlane" },
  
  // Others
  { command: "curl" }, 
];

class SafeCommandServer {
  private server: Server;
  private allowedCommands: AllowedCommand[];

  constructor() {
    this.server = new Server(
      {
        name: "gemini-safe-command-extension",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.allowedCommands = this.loadConfig();
    this.setupTools();
  }

  private loadConfig(): AllowedCommand[] {
    // 1. Environment variable (Best practice for Gemini CLI integration via settings.json)
    if (process.env.SAFE_COMMAND_CONFIG_PATH && existsSync(process.env.SAFE_COMMAND_CONFIG_PATH)) {
      return this.readConfigFile(process.env.SAFE_COMMAND_CONFIG_PATH);
    }

    // 2. XDG_CONFIG_HOME (Standard for CLI tools)
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    const xdgPath = join(xdgConfig, "gemini", "safe-command.json");
    if (existsSync(xdgPath)) {
      return this.readConfigFile(xdgPath);
    }

    return DEFAULT_ALLOWED_COMMANDS;
  }

  private readConfigFile(path: string): AllowedCommand[] {
    try {
      console.error(`Loading config from ${path}`);
      const configFile = readFileSync(path, "utf-8");
      const config = JSON.parse(configFile);
      
      if (Array.isArray(config.allowedCommands)) {
        return config.allowedCommands.map((cmd: any) => ({
          ...cmd,
          allowedArgs: cmd.allowedArgs?.map((arg: string) => this.parseRegex(arg)),
          deniedArgs: cmd.deniedArgs?.map((arg: string) => this.parseRegex(arg)),
        }));
      }
    } catch (error) {
      console.error(`Failed to load config from ${path}:`, error);
    }
    return DEFAULT_ALLOWED_COMMANDS;
  }

  private parseRegex(arg: string | RegExp): string | RegExp {
    if (typeof arg !== 'string') return arg;
    if (arg.startsWith('/') && arg.lastIndexOf('/') > 0) {
      try {
        const lastSlash = arg.lastIndexOf('/');
        const pattern = arg.substring(1, lastSlash);
        const flags = arg.substring(lastSlash + 1);
        return new RegExp(pattern, flags);
      } catch (e) {
        return arg;
      }
    }
    return arg;
  }

  private setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "run_safe_command",
          description: "Execute a shell command from a pre-approved whitelist. Use this for environment setup, building, and other development tasks safely. NOTE: Shell features like pipes (|), redirects (>), and command substitution ($()) are NOT supported.",
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The full command to execute (e.g., 'npm install'). Quotes are supported.",
              },
            },
            required: ["command"],
          } as const,
        },
      ] as Tool[],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "run_safe_command") {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      const commandStr = String(request.params.arguments?.command || "");
      
      try {
        const args = this.parseArgs(commandStr);
        if (args.length === 0) {
           return {
            content: [{ type: "text", text: `Error: Command is empty.` }],
            isError: true,
          };
        }

        const [cmd, ...cmdArgs] = args;

        const validationError = this.validateCommand(cmd, cmdArgs);
        if (validationError) {
          return {
            content: [{ type: "text", text: `Error: Command validation failed. ${validationError}` }],
            isError: true,
          };
        }

        console.error(`Executing safe command: ${cmd} ${cmdArgs.join(" ")}`);
        
        const result = await this.spawnAsync(cmd, cmdArgs);

        return {
          content: [
            { type: "text", text: `Stdout:\n${result.stdout}\n\nStderr:\n${result.stderr}` },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text", text: `Execution failed:\n${error.message}` },
          ],
          isError: true,
        };
      }
    });
  }

  public parseArgs(commandStr: string): string[] {
    const args: string[] = [];
    let current = "";
    let quote: string | null = null;
    let escape = false;
  
    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];
      
      if (escape) {
        current += char;
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }
  
      if (quote) {
        if (char === quote) {
          quote = null;
        } else {
          current += char;
        }
      } else {
        if (char === '"' || char === "'") {
          quote = char;
        } else if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
          if (current) {
            args.push(current);
            current = "";
          }
        } else {
          current += char;
        }
      }
    }
    
    if (quote) {
        throw new Error(`Syntax error: Unclosed quote ${quote}`);
    }

    if (current) args.push(current);
    return args;
  }

  public validateCommand(baseCommand: string, args: string[]): string | null {
    const allowedConfig = this.allowedCommands.find(c => c.command === baseCommand);
    if (!allowedConfig) {
      return `Command '${baseCommand}' is not in the allowed whitelist.`;
    }

    if (allowedConfig.allowedArgs || allowedConfig.deniedArgs) {
      for (const arg of args) {
        if (allowedConfig.deniedArgs) {
            const isDenied = allowedConfig.deniedArgs.some(denied => {
            if (typeof denied === 'string') {
              return arg === denied;
            } else if (denied instanceof RegExp) {
              return denied.test(arg);
            }
            return false;
          });
          if (isDenied) {
            return `Argument '${arg}' for command '${baseCommand}' is explicitly denied.`;
          }
        }

        if (allowedConfig.allowedArgs) {
          const isAllowedArg = allowedConfig.allowedArgs.some(allowed => {
            if (typeof allowed === 'string') {
              return arg === allowed;
            } else if (allowed instanceof RegExp) {
              return allowed.test(arg);
            }
            return false;
          });

          if (!isAllowedArg) {
            return `Argument '${arg}' for command '${baseCommand}' is not allowed.`;
          }
        }
      }
    }

    return null;
  }

  private spawnAsync(cmd: string, args: string[], timeoutMs = 10 * 60 * 1000, maxBuffer = 10 * 1024 * 1024): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { shell: false });
      
      let stdout = "";
      let stderr = "";
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const cleanup = () => clearTimeout(timeout);

      child.stdout.on("data", (data) => {
        if (stdout.length < maxBuffer) {
          stdout += data;
        } else if (!stdoutTruncated) {
          stdout += "\n...[Output truncated due to size limit]...";
          stdoutTruncated = true;
        }
      });

      child.stderr.on("data", (data) => {
        if (stderr.length < maxBuffer) {
          stderr += data;
        } else if (!stderrTruncated) {
          stderr += "\n...[Output truncated due to size limit]...";
          stderrTruncated = true;
        }
      });

      child.on("error", (error) => {
        cleanup();
        if (!timedOut) reject(error);
      });

      child.on("close", (code) => {
        cleanup();
        if (!timedOut) {
            if (code === 0) {
            resolve({ stdout, stderr });
            } else {
            reject(new Error(`Command exited with code ${code}\nStderr: ${stderr}`));
            }
        }
      });
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Safe Command MCP server running on stdio");
  }
}

if (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js')) {
    const server = new SafeCommandServer();
    server.run().catch(console.error);
}

export { SafeCommandServer };
