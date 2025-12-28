# 🛡️ Gemini Safe Command Extension

A custom MCP server for [Gemini CLI](https://github.com/google/gemini-cli) that provides a secure, whitelisted environment for executing shell commands. This extension is designed to be used with **Custom Slash Commands**, enabling you to define safe workflows for building, testing, and environment setup without granting unrestricted shell access.

## ✨ Features

- 📋 **Whitelist-based Execution**: Only pre-approved commands can be executed.
- 🔍 **Argument Validation**: Supports detailed validation of command arguments and subcommands.
- 🚫 **Dangerous Pattern Blocking**: Automatically blocks potentially destructive commands like `rm -rf /` or `sudo`.
- ⚙️ **Configurable**: Define your own allowed commands via a JSON config file.
- 🌐 **Cross-platform**: Built with Node.js and TypeScript for modern environments.

## 🚀 Installation

### Using Gemini CLI (Recommended)

You can install this extension directly from GitHub using the `gemini` command:

```bash
gemini extensions install https://github.com/sakistyle/gemini-safe-command-extension
```

## ⚙️ Configuration

By default, this extension comes with a pre-configured whitelist of common safe development commands (see `src/index.ts`).

To provide your own configuration, use the `settings.json` of Gemini CLI to point to your config file.

### 1. Create your config file
Create a JSON file anywhere on your system (e.g., `~/.config/gemini/safe-command.json`).

**Example `safe-command.json`:**
```json
{
  "allowedCommands": [
    { "command": "ls" },
    { "command": "npm", "allowedArgs": ["install", "run", "test", "/^[\\w@/.-]+$/"] },
    { "command": "git", "allowedArgs": ["status", "add", "commit", "/^[\\w@/.-]+$/"] }
  ]
}
```

### 2. Update Gemini CLI settings
Run `gemini config` (or edit `~/.gemini/settings.json`) and add the `SAFE_COMMAND_CONFIG_PATH` environment variable to the `safe-command` server definition.

```json
{
  "mcpServers": {
    "safe-command": {
      "env": {
        "SAFE_COMMAND_CONFIG_PATH": "/path/to/your/safe-command.json"
      }
    }
  }
}
```

## 💡 Usage

### Integration with Custom Slash Commands

This extension exposes a tool named `run_safe_command`. You can use this tool when defining **Custom Slash Commands** in your configuration to enable safe command execution.

**Example Scenario:**
You want to create a `/setup-project` command that initializes a project environment safely.

**Command execution:**
```bash
gemini -o text --allowed-tools read_file,list_directory,search_file_content,glob,write_file,replace,run_safe_command "Initialize the project environment using the /setup-project command definition"
```

## 🛠️ Development

This project uses [pnpm](https://pnpm.io/) for package management.

### ✅ Prerequisites
- Node.js >= 24
- pnpm >= 10

### 🔧 Setup
```bash
pnpm install
```

### 📦 Build
```bash
pnpm run build
```

### 🧪 Test
```bash
pnpm test
```

## 🔒 Security

This extension is a safety mechanism, not a perfect sandbox. It relies on `child_process.spawn` with `shell: false` to prevent shell-based injection, combined with argument whitelisting. 

- ⚠️ Always use the most restrictive whitelist possible.
- 🚫 Avoid allowing commands that can execute arbitrary code (e.g., `bash`, `python`, `eval`).

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
