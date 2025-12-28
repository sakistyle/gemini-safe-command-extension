import { describe, it, expect, beforeEach } from "vitest";
import { SafeCommandServer } from "../src/index.js";

describe("SafeCommandServer", () => {
  let server: SafeCommandServer;

  beforeEach(() => {
    server = new SafeCommandServer();
  });

  describe("parseArgs", () => {
    it("should parse simple commands", () => {
      expect(server.parseArgs("ls -la")).toEqual(["ls", "-la"]);
    });

    it("should handle quotes", () => {
      expect(server.parseArgs('git commit -m "fix bug"')).toEqual(["git", "commit", "-m", "fix bug"]);
      expect(server.parseArgs("echo 'hello world'")).toEqual(["echo", "hello world"]);
    });

    it("should handle escaped quotes (basic)", () => {
        // Escaped double quotes inside single quotes
        expect(server.parseArgs('echo \\"hello\\"')).toEqual(["echo", "\"hello\""]);
    });

    it("should throw error on unclosed quotes", () => {
        // Unclosed double quote
        expect(() => server.parseArgs(`echo "hello`)).toThrow(/Unclosed quote/);
        // Unclosed single quote
        expect(() => server.parseArgs(`echo 'hello`)).toThrow(/Unclosed quote/);
    });
  });

  describe("validateCommand", () => {
    it("should allow whitelisted commands", () => {
      expect(server.validateCommand("ls", [])).toBeNull();
      expect(server.validateCommand("pwd", [])).toBeNull();
    });

    it("should allow allowed arguments", () => {
      expect(server.validateCommand("npm", ["install"])).toBeNull();
      expect(server.validateCommand("npm", ["run", "build"])).toBeNull();
      expect(server.validateCommand("git", ["status"])).toBeNull();
    });

    it("should block non-whitelisted commands", () => {
      expect(server.validateCommand("rm", ["-rf", "/"])).not.toBeNull();
      expect(server.validateCommand("shutdown", [])).not.toBeNull();
    });

    it("should block disallowed arguments for restricted commands", () => {
      expect(server.validateCommand("npm", ["publish"])).not.toBeNull();
      expect(server.validateCommand("npm", ["whoami"])).not.toBeNull();
    });

    it("should allow dynamic arguments where configured (regex)", () => {
      // Verify that regex patterns like /^[\w@/.-]+$/ are working correctly
      expect(server.validateCommand("npm", ["install", "my-package"])).toBeNull();
      expect(server.validateCommand("npm", ["install", "@my-scope/pkg-name.js"])).toBeNull();
      // npx is removed from default allowed list for security
      expect(server.validateCommand("npx", ["create-next-app@latest"])).not.toBeNull();
    });
    
    it("should block arguments matching no allow-rule", () => {
        expect(server.validateCommand("npm", ["eval"])).not.toBeNull(); 
    });
  });
  
  describe("Security (No Shell)", () => {
      it("should treat shell operators as literal arguments (which are likely not allowed)", () => {
          expect(server.validateCommand("ls", ["|", "grep"])).toBeNull();
          expect(server.validateCommand("npm", ["install", "|", "bash"])).not.toBeNull();
      });
  });
});