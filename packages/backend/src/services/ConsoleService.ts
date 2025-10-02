import logger from '../config/logger';
import { randomUUID } from 'crypto';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../config/knex';

export interface ConsoleExecutionResult {
  output: string;
}

export interface ConsoleContext { user?: any }
export type ConsoleCommandHandler = (args: string[], ctx?: ConsoleContext) => Promise<ConsoleExecutionResult>;

interface CommandOption { flag: string; description: string; }
interface BuiltCommandDef {
  name: string;
  description?: string;
  options?: CommandOption[];
  audit?: boolean; // Whether to create audit log for this command
  action: (args: string[], ctx?: ConsoleContext, opts?: Record<string, any>) => Promise<ConsoleExecutionResult>;
}

class CommandBuilder {
  private def: BuiltCommandDef;
  constructor(name: string, private onBuild: (def: BuiltCommandDef) => void) {
    this.def = { name, action: async () => ({ output: '' }), audit: false } as BuiltCommandDef;
  }
  description(desc: string) { this.def.description = desc; return this; }
  option(flag: string, description: string) {
    if (!this.def.options) this.def.options = [];
    this.def.options.push({ flag, description });
    return this;
  }
  audit(enabled: boolean = true) { this.def.audit = enabled; return this; }
  action(fn: BuiltCommandDef['action']) { this.def.action = fn; return this; }
  register() { this.onBuild(this.def); return this; }
}

class ConsoleService {
  private legacyHandlers: Map<string, ConsoleCommandHandler> = new Map();
  private descriptions: Map<string, string> = new Map();
  private builtCommands: Map<string, BuiltCommandDef> = new Map();
  private legacyAuditFlags: Map<string, boolean> = new Map(); // Track audit flags for legacy commands

  public command(name: string) {
    return new CommandBuilder(name, (def) => {
      this.builtCommands.set(def.name, def);
      if (def.description) this.descriptions.set(def.name, def.description);
    });
  }

  public register(name: string, handler: ConsoleCommandHandler, description?: string, audit: boolean = false) {
    this.legacyHandlers.set(name, handler);
    if (description) this.descriptions.set(name, description);
    this.legacyAuditFlags.set(name, audit);
  }

  constructor() {
    // Register built-in legacy/simple commands
    this.register('help', this.helpCommand, 'Show available commands');
    this.register('echo', this.echoCommand, 'Echo back arguments. Supports color flags: --red|--green|--yellow|--blue|--magenta|--cyan|--white');
    this.register('date', this.dateCommand, 'Print server date (supports +FORMAT, --iso, --rfc)');
    this.register('time', this.timeCommand, 'Print server time (supports +FORMAT)');
    this.register('timezone', this.timezoneCommand, 'Print server timezone and offset');
    this.register('uptime', this.uptimeCommand, 'Show server uptime in human readable form');
    this.register('clear', this.clearCommand, 'Clear the console');
    this.register('sysinfo', this.sysinfoCommand, 'Show Node/OS/Process information');
    this.register('env', this.envCommand, 'Show whitelisted environment variables');
    this.register('uuid', this.uuidCommand, 'Generate a random UUID v4');
    this.register('ulid', this.ulidCommand, 'Generate a ULID (Universally Unique Lexicographically Sortable Identifier)');
    // base64 is registered below with builder pattern
    this.register('health', this.healthCommand, 'Server health check');

    // Builder-style (commander-like) registrations
    this.command('whoami')
      .description('Display current user information')
      .audit(true)
      .register()
      .action(async (_args, ctx) => {
        const u = ctx?.user;
        if (!u) return { output: 'Not authenticated' };
        const lines = [
          `ID: ${u.id ?? ''}`,
          `Name: ${u.name ?? ''}`,
          `Email: ${u.email ?? ''}`,
          `Role: ${u.role ?? ''}`,
        ];
        return { output: lines.join('\n') };
      });

    this.command('echo')
      .description('Echo back arguments with optional color')
      .option('--red', 'Red color')
      .option('--green', 'Green color')
      .option('--yellow', 'Yellow color')
      .option('--blue', 'Blue color')
      .option('--magenta', 'Magenta color')
      .option('--cyan', 'Cyan color')
      .option('--white', 'White color')
      .audit(false) // echo is not audited
      .register()
      .action(async (args, ctx, opts) => this.echoCommand(args, ctx, opts));

    this.command('base64')
      .description('Base64 encode/decode')
      .option('--encode', 'Encode text to base64')
      .option('--decode', 'Decode base64 to text')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.base64Command(args, ctx, opts));

    this.command('jwt-secret')
      .description('Generate a secure JWT secret key')
      .option('--length', 'Length in bytes (default: 64)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.jwtSecretCommand(args, ctx, opts));

    this.command('hash')
      .description('Hash text using bcrypt')
      .option('--rounds', 'Salt rounds (default: 12)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.hashCommand(args, ctx, opts));

    this.command('encrypt')
      .description('Encrypt text using specified algorithm')
      .option('--key', 'Encryption key (hex). If not provided, generates a new key')
      .option('--algo', 'Algorithm: aes256-gcm (default), aes256-cbc, chacha20-poly1305')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.encryptCommand(args, ctx, opts));

    this.command('decrypt')
      .description('Decrypt text using specified algorithm')
      .option('--key', 'Encryption key (hex, required)')
      .option('--algo', 'Algorithm: aes256-gcm (default), aes256-cbc, chacha20-poly1305')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.decryptCommand(args, ctx, opts));

    this.command('api-token')
      .description('Generate API access token')
      .option('--name', 'Token name (required)')
      .option('--type', 'Token type: client or server (required)')
      .option('--description', 'Token description (optional)')
      .option('--expires', 'Expiration date in days (optional)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.apiKeyCommand(args, ctx, opts));

    this.command('api-token-delete')
      .description('Delete API access token')
      .option('--id', 'Token ID (required)')
      .option('--name', 'Token name (alternative to ID)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.apiTokenDeleteCommand(args, ctx, opts));

    this.command('random')
      .description('Generate random string')
      .option('--length', 'Length in bytes (default: 32)')
      .option('--hex', 'Output as hex (default)')
      .option('--base64', 'Output as base64')
      .option('--alphanumeric', 'Output as alphanumeric')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.randomCommand(args, ctx, opts));

    this.command('gen-login-id')
      .description('Generate login-friendly user ID (starts with a letter, contains digits)')
      .option('--length', 'Total length (default: 12)')
      .option('--count', 'How many to generate (default: 1)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.genLoginIdCommand(args, ctx, opts));

    this.command('gen-login-password')
      .description('Generate login-friendly password (starts with a letter; includes digits and symbols)')
      .option('--length', 'Total length (default: 14)')
      .option('--count', 'How many to generate (default: 1)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.genLoginPasswordCommand(args, ctx, opts));


    this.command('db-stats')
      .description('Show database statistics')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.dbStatsCommand(args, ctx, opts));

    this.command('cache-clear')
      .description('Clear Redis cache')
      .option('--pattern', 'Cache key pattern (default: all)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.cacheClearCommand(args, ctx, opts));

    this.command('cache-stats')
      .description('Show Redis cache statistics')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.cacheStatsCommand(args, ctx, opts));

    this.command('api-token-list')
      .description('List API tokens')
      .option('--type', 'Filter by type (client|server)')
      .option('--limit', 'Limit results (default: 10)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.tokenListCommand(args, ctx, opts));

    this.command('user-info')
      .description('Get user information by ID or email')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.userInfoCommand(args, ctx, opts));

    this.command('timestamp')
      .description('Convert timestamp or get current timestamp')
      .option('--ms', 'Output in milliseconds')
      .option('--iso', 'Output in ISO format')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.timestampCommand(args, ctx, opts));

    this.command('unixtimestamp')
      .description('Get current Unix timestamp')
      .option('--ms', 'Output in milliseconds (default: seconds)')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.unixtimestampCommand(args, ctx, opts));

    this.command('md5')
      .description('Generate MD5 hash')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.md5Command(args, ctx, opts));

    this.command('sha256')
      .description('Generate SHA256 hash')
      .audit(true)
      .register()
      .action(async (args, ctx, opts) => this.sha256Command(args, ctx, opts));


  }



  public listCommands(): string[] {
    return Array.from(new Set([
      ...Array.from(this.legacyHandlers.keys()),
      ...Array.from(this.builtCommands.keys()),
      ...Array.from(this.descriptions.keys()),
    ])).sort();
  }

  public shouldAudit(command: string): boolean {
    const built = this.builtCommands.get(command);
    if (built) {
      return built.audit === true;
    }
    // Check legacy commands
    return this.legacyAuditFlags.get(command) === true;
  }

  private showCommandHelp(command: string, built: BuiltCommandDef): ConsoleExecutionResult {
    const lines = [
      `\u001b[1m${command}\u001b[0m - ${built.description || 'No description'}`,
      ''
    ];

    if (built.options && built.options.length > 0) {
      lines.push('\u001b[1mOptions:\u001b[0m');
      for (const opt of built.options) {
        lines.push(`  \u001b[36m${opt.flag.padEnd(20)}\u001b[0m ${opt.description}`);
      }
      lines.push('');
    }

    lines.push('\u001b[1mUsage:\u001b[0m');
    if (built.options && built.options.length > 0) {
      const optStr = built.options.map(o => `[${o.flag.split(' ')[0]}]`).join(' ');
      lines.push(`  ${command} ${optStr} [arguments]`);
    } else {
      lines.push(`  ${command} [arguments]`);
    }

    return { output: lines.join('\n') };
  }

  private parseOptions(argv: string[]): { args: string[]; opts: Record<string, any> } {
    const args: string[] = [];
    const opts: Record<string, any> = {};
    for (let i = 0; i < argv.length; i++) {
      const tok = argv[i];
      if (tok.startsWith('--')) {
        const [k, v] = tok.slice(2).split('=');
        if (v !== undefined) opts[k] = v;
        else if (argv[i + 1] && !argv[i + 1].startsWith('-')) { opts[k] = argv[i + 1]; i++; }
        else opts[k] = true;
      } else if (tok.startsWith('-') && tok.length > 1) {
        const flags = tok.slice(1).split('');
        for (const f of flags) opts[f] = true;
      } else {
        args.push(tok);
      }
    }
    return { args, opts };
  }


  public async execute(command: string, argv: string[] = [], ctx?: ConsoleContext): Promise<ConsoleExecutionResult> {
    const built = this.builtCommands.get(command);
    if (built) {
      try {
        const { args, opts } = this.parseOptions(argv);

        // Handle --help option
        if (opts.help === true) {
          return this.showCommandHelp(command, built);
        }

        return await built.action(args, ctx, opts);
      } catch (e: any) {
        logger.error(`Console command error for ${command}:`, e);
        return { output: `\x1b[31mError:\x1b[0m ${e?.message || 'Unknown error'}` };
      }
    }
    const legacy = this.legacyHandlers.get(command);
    if (!legacy) {
      return { output: `\x1b[31mUnknown command:\x1b[0m ${command}` };
    }
    try {
      return await legacy(argv, ctx);
    } catch (e: any) {
      logger.error(`Console command error for ${command}:`, e);
      return { output: `\x1b[31mError:\x1b[0m ${e?.message || 'Unknown error'}` };
    }
  }

  // Built-in: help (commander-like with categories)
  private helpCommand = async (): Promise<ConsoleExecutionResult> => {
    const categories: Record<string, string[]> = {
      'Basic': ['help', 'echo', 'clear', 'whoami'],
      'Date & Time': ['date', 'time', 'timezone', 'uptime', 'timestamp', 'unixtimestamp'],
      'ID Generation': ['uuid', 'ulid'],
      'Auth Utilities': ['gen-login-id', 'gen-login-password'],
      'Security & Crypto': ['jwt-secret', 'hash', 'encrypt', 'decrypt', 'random', 'md5', 'sha256'],
      'API Management': ['api-token', 'api-token-delete', 'api-token-list'],
      'Database': ['db-stats'],
      'Cache': ['cache-clear', 'cache-stats'],
      'User Management': ['user-info'],
      'System Info': ['sysinfo', 'env', 'health'],
      'Utilities': ['base64']
    };

    const header = [
      '\u001b[1mUsage:\u001b[0m',
      '  command [options] [arguments]',
      '',
      '\u001b[1mAvailable Commands:\u001b[0m',
      ''
    ];

    const sections: string[] = [];
    for (const [category, commands] of Object.entries(categories)) {
      sections.push(`\u001b[33m${category}:\u001b[0m`);
      for (const name of commands) {
        const desc = this.descriptions.get(name) || '';
        sections.push(`  \u001b[36m${name.padEnd(20)}\u001b[0m ${desc}`);
      }
      sections.push('');
    }

    const footer = [
      '\u001b[90mTip: Use "command --help" for detailed options (if supported)\u001b[0m',
      '\u001b[90mTip: Use "|clip" at the end to copy output to clipboard\u001b[0m'
    ];

    return { output: [...header, ...sections, ...footer].join('\n') };
  };

  // Built-in: echo
  private echoCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    // Color flags: --red, --green, --yellow, --blue, --magenta, --cyan, --white
    const colorMap: Record<string, string> = {
      red: '\u001b[31m',
      green: '\u001b[32m',
      yellow: '\u001b[33m',
      blue: '\u001b[34m',
      magenta: '\u001b[35m',
      cyan: '\u001b[36m',
      white: '\u001b[37m',
    };
    let color = '';
    let text = args.join(' ');

    // Determine color from opts (parseOptions may have consumed the next arg as value)
    const colorFlag = (['red','green','yellow','blue','magenta','cyan','white'] as const)
      .find((name) => opts?.[name] !== undefined && opts?.[name] !== false);

    if (colorFlag) {
      color = colorMap[colorFlag];

      // If parseOptions consumed the text as the color flag's value, get it back
      if (opts && typeof opts[colorFlag] === 'string') {
        text = opts[colorFlag] + (text ? ' ' + text : '');
      }
    }

    const output = color ? `${color}${text}\u001b[0m` : text;
    return { output };
  };

  // Built-in: date (Ubuntu-like)
  private dateCommand = async (args: string[] = []): Promise<ConsoleExecutionResult> => {
    const now = new Date();

    // Support: date +"%Y-%m-%d %H:%M:%S %Z"
    const fmtArg = args.find((a) => a.startsWith('+'));
    if (fmtArg) {
      const fmt = fmtArg.slice(1);
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const offsetMin = -now.getTimezoneOffset();
      const sign = offsetMin >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMin);
      const offH = pad(Math.floor(abs / 60));
      const offM = pad(abs % 60);
      const map: Record<string, string> = {
        '%Y': String(now.getFullYear()),
        '%m': pad(now.getMonth() + 1),
        '%d': pad(now.getDate()),
        '%H': pad(now.getHours()),
        '%M': pad(now.getMinutes()),
        '%S': pad(now.getSeconds()),
        '%Z': `${tzName}`,
        '%z': `${sign}${offH}${offM}`,
        '%T': `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      };
      const out = fmt.replace(/%[YmdHMSZzT]/g, (m) => map[m] ?? m);
      return { output: out };
    }

    // Support: --iso | --iso=seconds | --rfc
    if (args.includes('--iso') || args.includes('--iso=seconds')) {
      return { output: now.toISOString() };
    }
    if (args.includes('--rfc')) {
      return { output: now.toUTCString() };
    }

    // Default like Ubuntu date (approx)
    const locale = now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' });
    // Example: Tue, Oct 01, 16:40:12 GMT+9 -> adjust to a closer GNU date-like string
    return { output: locale.replace(',', '') };
  };

  // Built-in: time (Ubuntu-like)
  private timeCommand = async (args: string[] = []): Promise<ConsoleExecutionResult> => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    if (args.find((a) => a.startsWith('+'))) {
      // Delegate to date +FORMAT but only time tokens
      const fmt = args.find((a) => a.startsWith('+'))!.slice(1);
      const map: Record<string, string> = {
        '%H': pad(now.getHours()),
        '%M': pad(now.getMinutes()),
        '%S': pad(now.getSeconds()),
        '%T': `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      };
      const out = fmt.replace(/%[HMST]/g, (m) => map[m] ?? m);
      return { output: out };
    }
    return { output: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` };
  };

  // Built-in: timezone (Ubuntu-like summary)
  private timezoneCommand = async (): Promise<ConsoleExecutionResult> => {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const offsetMin = -now.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    const short = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || 'UTC';
    return { output: `Time zone: ${tz} (${short}, ${sign}${hh}:${mm})` };
  };

  // Built-in: uptime (Ubuntu-like short)
  private uptimeCommand = async (): Promise<ConsoleExecutionResult> => {
    const secs = Math.floor(process.uptime());
    const days = Math.floor(secs / 86400);
    const hrs = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const hhmm = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    const prefix = days ? `${days} day${days > 1 ? 's' : ''}, ` : '';
    return { output: `up ${prefix}${hhmm}, ${s}s` };
  };

  // Extra: sysinfo
  private sysinfoCommand = async (): Promise<ConsoleExecutionResult> => {
    const mem = process.memoryUsage();
    const fmtMB = (n: number) => `${Math.round(n / 1024 / 1024)}MB`;
    const lines = [
      `Node: ${process.version}`,
      `Platform: ${process.platform}`,
      `Arch: ${process.arch}`,
      `PID: ${process.pid}`,
      `Memory: rss=${fmtMB(mem.rss)} heapUsed=${fmtMB(mem.heapUsed)} heapTotal=${fmtMB(mem.heapTotal)}`,
      `Uptime: ${Math.floor(process.uptime())}s`,
    ];
    return { output: lines.join('\n') };
  };

  // Extra: env (whitelisted)
  private envCommand = async (): Promise<ConsoleExecutionResult> => {
    const whitelist = ['NODE_ENV', 'PORT', 'API_VERSION'];
    const lines = whitelist.map(k => `${k}=${process.env[k] ?? ''}`);
    return { output: lines.join('\n') };
  };

  // Extra: uuid
  private uuidCommand = async (): Promise<ConsoleExecutionResult> => {
    return { output: randomUUID() };
  };

  // Extra: base64
  private base64Command = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    // opts.encode and opts.decode can be true or a string value (if parseOptions consumed next arg)
    const hasEncode = opts?.encode !== undefined && opts?.encode !== false;
    const hasDecode = opts?.decode !== undefined && opts?.decode !== false;

    // If opts.encode/decode consumed the text as value, get it back
    let text = args.join(' ');
    if (hasEncode && typeof opts.encode === 'string') {
      text = opts.encode + (text ? ' ' + text : '');
    } else if (hasDecode && typeof opts.decode === 'string') {
      text = opts.decode + (text ? ' ' + text : '');
    }

    if (hasEncode && !hasDecode) {
      if (!text) {
        return { output: '\u001b[31mError:\u001b[0m Please provide text to encode' };
      }
      return { output: Buffer.from(text, 'utf-8').toString('base64') };
    }
    if (hasDecode && !hasEncode) {
      if (!text) {
        return { output: '\u001b[31mError:\u001b[0m Please provide base64 text to decode' };
      }
      try { return { output: Buffer.from(text, 'base64').toString('utf-8') }; }
      catch { return { output: '\u001b[31mInvalid base64\u001b[0m' }; }
    }
    return { output: 'Usage: base64 --encode <text> | base64 --decode <b64>' };
  };

  // Extra: health
  private healthCommand = async (): Promise<ConsoleExecutionResult> => {
    return { output: '\u001b[32m\u2713\u001b[0m Server is healthy' };
  };


  // Built-in: clear (server-side no-op, ANSI clear for terminals that support it)
  private clearCommand = async (): Promise<ConsoleExecutionResult> => {
    // ANSI: clear screen and move cursor to home
    return { output: `\u001b[2J\u001b[H` };
  };

  // Extra: ulid - Generate ULID
  private ulidCommand = async (args: string[] = []): Promise<ConsoleExecutionResult> => {
    const count = args[0] ? parseInt(args[0], 10) : 1;
    if (isNaN(count) || count < 1 || count > 100) {
      return { output: '\u001b[31mError:\u001b[0m Count must be between 1 and 100' };
    }

    const ulids: string[] = [];
    for (let i = 0; i < count; i++) {
      ulids.push(this.generateULID());
    }

    return { output: ulids.join('\n') };
  };

  // Helper: Generate ULID (Universally Unique Lexicographically Sortable Identifier)
  private generateULID(): string {
    // ULID format: 10 characters timestamp + 16 characters randomness
    const timestamp = Date.now();
    const timeChars = this.encodeTime(timestamp, 10);
    const randomChars = this.encodeRandom(16);
    return timeChars + randomChars;
  }

  private encodeTime(now: number, len: number): string {
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's Base32
    let str = '';
    for (let i = len - 1; i >= 0; i--) {
      const mod = now % 32;
      str = ENCODING[mod] + str;
      now = Math.floor(now / 32);
    }
    return str;
  }

  private encodeRandom(len: number): string {
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const bytes = crypto.randomBytes(len);
    let str = '';
    for (let i = 0; i < len; i++) {
      str += ENCODING[bytes[i] % 32];
    }
    return str;
  }

  // Command: jwt-secret - Generate JWT secret
  private jwtSecretCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const length = opts?.length ? parseInt(opts.length, 10) : 64;
    if (isNaN(length) || length < 32 || length > 256) {
      return { output: '\u001b[31mError:\u001b[0m Length must be between 32 and 256 bytes' };
    }

    const secret = crypto.randomBytes(length).toString('base64');
    const lines = [
      '\u001b[32mJWT Secret Generated:\u001b[0m',
      '',
      secret,
      '',
      '\u001b[33mAdd this to your .env file:\u001b[0m',
      `JWT_SECRET=${secret}`
    ];
    return { output: lines.join('\n') };
  };

  // Command: hash - Hash text using bcrypt
  private hashCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const text = args.join(' ');
    if (!text) {
      return { output: '\u001b[31mError:\u001b[0m Please provide text to hash' };
    }

    const rounds = opts?.rounds ? parseInt(opts.rounds, 10) : 12;
    if (isNaN(rounds) || rounds < 4 || rounds > 20) {
      return { output: '\u001b[31mError:\u001b[0m Rounds must be between 4 and 20' };
    }

    try {
      const hash = await bcrypt.hash(text, rounds);
      const lines = [
        '\u001b[32mBcrypt Hash:\u001b[0m',
        '',
        hash,
        '',
        `\u001b[90mRounds: ${rounds}\u001b[0m`
      ];
      return { output: lines.join('\n') };
    } catch (error: any) {
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Hash failed'}` };
    }
  };

  // Command: encrypt - Encrypt text using specified algorithm
  private encryptCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const text = args.join(' ');
    if (!text) {
      return { output: '\u001b[31mError:\u001b[0m Please provide text to encrypt' };
    }

    // Determine algorithm
    const algo = opts?.algo || 'aes256-gcm';
    const supportedAlgos = ['aes256-gcm', 'aes256-cbc', 'chacha20-poly1305'];
    if (!supportedAlgos.includes(algo)) {
      return { output: `\u001b[31mError:\u001b[0m Unsupported algorithm. Use: ${supportedAlgos.join(', ')}` };
    }

    try {
      let key: Buffer;
      let keyHex: string;
      let keySize = 32; // Default for AES-256 and ChaCha20

      if (opts?.key) {
        keyHex = opts.key;
        const expectedLength = keySize * 2; // hex = 2 chars per byte
        if (keyHex.length !== expectedLength) {
          return { output: `\u001b[31mError:\u001b[0m Key must be ${expectedLength} hex characters (${keySize} bytes)` };
        }
        key = Buffer.from(keyHex, 'hex');
      } else {
        key = crypto.randomBytes(keySize);
        keyHex = key.toString('hex');
      }

      let encrypted: string;
      let iv: Buffer;
      let authTag: Buffer | undefined;
      let ivSize = 16; // Default IV size

      if (algo === 'aes256-gcm') {
        ivSize = 12; // GCM typically uses 12 bytes
        iv = crypto.randomBytes(ivSize);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
        authTag = cipher.getAuthTag();
      } else if (algo === 'aes256-cbc') {
        ivSize = 16;
        iv = crypto.randomBytes(ivSize);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
      } else if (algo === 'chacha20-poly1305') {
        ivSize = 12; // ChaCha20-Poly1305 uses 12-byte nonce
        iv = crypto.randomBytes(ivSize);
        const cipher = crypto.createCipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 } as any);
        encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
        authTag = cipher.getAuthTag();
      } else {
        return { output: '\u001b[31mError:\u001b[0m Algorithm not implemented' };
      }

      const lines = [
        '\u001b[32mEncrypted:\u001b[0m',
        '',
        `Algorithm: ${algo}`,
        `Encrypted: ${encrypted}`,
        `IV: ${iv.toString('hex')}`,
        authTag ? `Auth Tag: ${authTag.toString('hex')}` : '',
        `Key: ${keyHex}`,
        '',
        '\u001b[33mTo decrypt, use:\u001b[0m',
        authTag
          ? `decrypt --algo ${algo} --key ${keyHex} ${encrypted}:${iv.toString('hex')}:${authTag.toString('hex')}`
          : `decrypt --algo ${algo} --key ${keyHex} ${encrypted}:${iv.toString('hex')}`
      ].filter(Boolean);
      return { output: lines.join('\n') };
    } catch (error: any) {
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Encryption failed'}` };
    }
  };

  // Command: decrypt - Decrypt text using specified algorithm
  private decryptCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    if (!opts?.key) {
      return { output: '\u001b[31mError:\u001b[0m --key is required' };
    }

    const encryptedData = args.join(' ');
    if (!encryptedData) {
      return { output: '\u001b[31mError:\u001b[0m Please provide encrypted data in format: encrypted:iv[:authTag]' };
    }

    // Determine algorithm
    const algo = opts?.algo || 'aes256-gcm';
    const supportedAlgos = ['aes256-gcm', 'aes256-cbc', 'chacha20-poly1305'];
    if (!supportedAlgos.includes(algo)) {
      return { output: `\u001b[31mError:\u001b[0m Unsupported algorithm. Use: ${supportedAlgos.join(', ')}` };
    }

    try {
      const parts = encryptedData.split(':');
      const requiresAuthTag = algo === 'aes256-gcm' || algo === 'chacha20-poly1305';

      if (requiresAuthTag && parts.length !== 3) {
        return { output: '\u001b[31mError:\u001b[0m Invalid format for AEAD cipher. Use: encrypted:iv:authTag' };
      }
      if (!requiresAuthTag && parts.length !== 2) {
        return { output: '\u001b[31mError:\u001b[0m Invalid format. Use: encrypted:iv' };
      }

      const encrypted = parts[0];
      const ivHex = parts[1];
      const authTagHex = parts[2];

      const key = Buffer.from(opts.key, 'hex');
      const iv = Buffer.from(ivHex, 'hex');

      let decrypted: string;

      if (algo === 'aes256-gcm') {
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      } else if (algo === 'aes256-cbc') {
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      } else if (algo === 'chacha20-poly1305') {
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 } as any);
        decipher.setAuthTag(authTag);
        decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      } else {
        return { output: '\u001b[31mError:\u001b[0m Algorithm not implemented' };
      }

      const lines = [
        '\u001b[32mDecrypted:\u001b[0m',
        '',
        decrypted
      ];
      return { output: lines.join('\n') };
    } catch (error: any) {
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Decryption failed'}` };
    }
  };

  // Command: api-token - Generate API access token
  private apiKeyCommand = async (args: string[], ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const tokenName = opts?.name;
    const tokenType = opts?.type;
    const description = opts?.description || null;
    const expiresInDays = opts?.expires ? parseInt(opts.expires, 10) : null;

    if (!tokenName) {
      return { output: '\u001b[31mError:\u001b[0m --name is required' };
    }

    if (!tokenType || !['client', 'server'].includes(tokenType)) {
      return { output: '\u001b[31mError:\u001b[0m --type must be either "client" or "server"' };
    }

    if (expiresInDays !== null && (isNaN(expiresInDays) || expiresInDays < 1)) {
      return { output: '\u001b[31mError:\u001b[0m --expires must be a positive number' };
    }

    try {
      const userId = ctx?.user?.id || 1;

      // Generate token
      const tokenValue = crypto.randomBytes(32).toString('hex');
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

      // Insert into database
      const [id] = await db('g_api_access_tokens').insert({
        tokenName,
        description,
        tokenHash: tokenValue,
        tokenType,
        environmentId: null,
        expiresAt,
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const lines = [
        '\u001b[32mAPI Token Created:\u001b[0m',
        '',
        `ID: ${id}`,
        `Name: ${tokenName}`,
        `Type: ${tokenType}`,
        `Token: ${tokenValue}`,
        description ? `Description: ${description}` : '',
        expiresAt ? `Expires: ${expiresAt.toISOString()}` : 'Expires: Never',
        '',
        '\u001b[33m⚠️  Save this token securely. It cannot be retrieved again!\u001b[0m',
        '',
        '\u001b[36mUsage:\u001b[0m',
        `Authorization: Bearer ${tokenValue}`,
        `or`,
        `X-API-Token: ${tokenValue}`
      ].filter(Boolean);

      return { output: lines.join('\n') };
    } catch (error: any) {
      logger.error('API key generation error:', error);
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Failed to create API token'}` };
    }
  };

  // Command: api-token-delete - Delete API access token
  private apiTokenDeleteCommand = async (args: string[], ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const tokenId = opts?.id;
    const tokenName = opts?.name;

    if (!tokenId && !tokenName) {
      return { output: '\u001b[31mError:\u001b[0m Either --id or --name is required' };
    }

    try {
      let query = db('g_api_access_tokens');

      if (tokenId) {
        query = query.where('id', tokenId);
      } else if (tokenName) {
        query = query.where('tokenName', tokenName);
      }

      // Check if token exists
      const existingToken = await query.first();

      if (!existingToken) {
        return { output: '\u001b[31mError:\u001b[0m Token not found' };
      }

      // Delete token
      await query.del();

      const lines = [
        '\u001b[32mAPI Token Deleted:\u001b[0m',
        '',
        `ID: ${existingToken.id}`,
        `Name: ${existingToken.tokenName}`,
        `Type: ${existingToken.tokenType}`,
        '',
        '\u001b[32m✓ Token has been permanently deleted\u001b[0m'
      ];

      return { output: lines.join('\n') };
    } catch (error: any) {
      logger.error('API token deletion error:', error);
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Failed to delete API token'}` };
    }
  };

  // Command: random - Generate random string
  private randomCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const length = opts?.length ? parseInt(opts.length, 10) : 32;
    if (isNaN(length) || length < 1 || length > 256) {
      return { output: '\u001b[31mError:\u001b[0m Length must be between 1 and 256 bytes' };
    }

    const bytes = crypto.randomBytes(length);
    let output: string;

    if (opts?.base64) {
      output = bytes.toString('base64');
    } else if (opts?.alphanumeric) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      output = '';
      for (let i = 0; i < length; i++) {
        output += chars[bytes[i] % chars.length];
      }
    } else {
      // Default: hex
      output = bytes.toString('hex');
    }

    return { output };
  };

  // Command: db-stats - Show database statistics
  private dbStatsCommand = async (_args: string[], _ctx?: ConsoleContext, _opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    try {
      const tables = [
        'g_users',
        'g_api_access_tokens',
        'g_message_templates',
        'g_tags',
        'g_tag_assignments',
        'g_jobs',
        'g_client_versions',
        'g_game_worlds'
      ];

      const stats = await Promise.all(
        tables.map(async (table) => {
          try {
            const result = await db(table).count('* as count').first();
            return { table, count: result?.count || 0 };
          } catch {
            return { table, count: 'N/A' };
          }
        })
      );

      const lines = [
        '\u001b[32mDatabase Statistics:\u001b[0m',
        '',
        ...stats.map(s => `  ${s.table.padEnd(30)} ${String(s.count).padStart(10)}`),
        '',
        `\u001b[90mTotal tables: ${stats.length}\u001b[0m`
      ];

      return { output: lines.join('\n') };
    } catch (error: any) {
      logger.error('DB stats error:', error);
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Failed to get database stats'}` };
    }
  };

  // Command: cache-clear - Clear Redis cache
  private cacheClearCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    try {
      const pattern = opts?.pattern || '*';
      // Note: This requires Redis client to be available
      // For now, return a placeholder message
      const lines = [
        '\u001b[33mCache Clear:\u001b[0m',
        '',
        `Pattern: ${pattern}`,
        '',
        '\u001b[90mNote: Redis cache clearing requires Redis client integration\u001b[0m'
      ];
      return { output: lines.join('\n') };
    } catch (error: any) {
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Failed to clear cache'}` };
    }
  };

  // Command: cache-stats - Show cache statistics
  private cacheStatsCommand = async (_args: string[], _ctx?: ConsoleContext, _opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    try {
      const lines = [
        '\u001b[32mCache Statistics:\u001b[0m',
        '',
        '\u001b[90mNote: Redis cache statistics require Redis client integration\u001b[0m'
      ];
      return { output: lines.join('\n') };
    } catch (error: any) {
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Failed to get cache stats'}` };
    }
  };

  // Command: api-token-list - List API tokens
  private tokenListCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    try {
      const tokenType = opts?.type;
      const limit = opts?.limit ? parseInt(opts.limit, 10) : 10;

      let query = db('g_api_access_tokens as t')
        .leftJoin('g_users as u', 't.createdBy', 'u.id')
        .select([
          't.id',
          't.tokenName',
          't.tokenType',
          't.expiresAt',
          't.createdAt',
          'u.name as createdByName'
        ])
        .orderBy('t.createdAt', 'desc')
        .limit(limit);

      if (tokenType) {
        query = query.where('t.tokenType', tokenType);
      }

      const tokens = await query;

      if (tokens.length === 0) {
        return { output: '\u001b[33mNo tokens found\u001b[0m' };
      }

      const lines = [
        '\u001b[32mAPI Tokens:\u001b[0m',
        '',
        'ID'.padEnd(6) + 'Name'.padEnd(25) + 'Type'.padEnd(10) + 'Created By'.padEnd(20) + 'Expires',
        '─'.repeat(80),
        ...tokens.map((t: any) => {
          const id = String(t.id).padEnd(6);
          const name = (t.tokenName || '').substring(0, 24).padEnd(25);
          const type = (t.tokenType || '').padEnd(10);
          const creator = (t.createdByName || 'Unknown').substring(0, 19).padEnd(20);
          const expires = t.expiresAt ? new Date(t.expiresAt).toISOString().split('T')[0] : 'Never';
          return `${id}${name}${type}${creator}${expires}`;
        })
      ];

      return { output: lines.join('\n') };
    } catch (error: any) {
      logger.error('Token list error:', error);
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Failed to list tokens'}` };
    }
  };

  // Command: user-info - Get user information
  private userInfoCommand = async (args: string[], _ctx?: ConsoleContext, _opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const identifier = args.join(' ').trim();
    if (!identifier) {
      return { output: '\u001b[31mError:\u001b[0m Please provide user ID or email' };
    }

    try {
      let user;
      if (/^\d+$/.test(identifier)) {
        // Numeric ID
        user = await db('g_users').where('id', parseInt(identifier, 10)).first();
      } else {
        // Email
        user = await db('g_users').where('email', identifier).first();
      }

      if (!user) {
        return { output: '\u001b[33mUser not found\u001b[0m' };
      }

      const lines = [
        '\u001b[32mUser Information:\u001b[0m',
        '',
        `ID: ${user.id}`,
        `Name: ${user.name || 'N/A'}`,
        `Email: ${user.email}`,
        `Role: ${user.role || 'user'}`,
        `Status: ${user.status || 'unknown'}`,
        `Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`,
        `Created: ${user.createdAt ? new Date(user.createdAt).toISOString() : 'N/A'}`,
        `Last Login: ${user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : 'Never'}`
      ];

      return { output: lines.join('\n') };
    } catch (error: any) {
      logger.error('User info error:', error);
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Failed to get user info'}` };
    }
  };

  // Command: timestamp - Timestamp utilities
  private timestampCommand = async (args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const input = args.join(' ').trim();

    if (!input) {
      // Current timestamp
      const now = Date.now();
      const date = new Date(now);

      if (opts?.ms) {
        return { output: String(now) };
      } else if (opts?.iso) {
        return { output: date.toISOString() };
      } else {
        const lines = [
          `Unix (seconds): ${Math.floor(now / 1000)}`,
          `Unix (ms): ${now}`,
          `ISO: ${date.toISOString()}`,
          `Local: ${date.toLocaleString()}`
        ];
        return { output: lines.join('\n') };
      }
    }

    // Convert input timestamp
    try {
      let timestamp: number;
      if (/^\d+$/.test(input)) {
        timestamp = parseInt(input, 10);
        // If less than 10 digits, assume seconds
        if (timestamp < 10000000000) {
          timestamp *= 1000;
        }
      } else {
        timestamp = new Date(input).getTime();
      }

      if (isNaN(timestamp)) {
        return { output: '\u001b[31mError:\u001b[0m Invalid timestamp' };
      }

      const date = new Date(timestamp);
      const lines = [
        `Unix (seconds): ${Math.floor(timestamp / 1000)}`,
        `Unix (ms): ${timestamp}`,
        `ISO: ${date.toISOString()}`,
        `Local: ${date.toLocaleString()}`
      ];
      return { output: lines.join('\n') };
    } catch (error: any) {
      return { output: `\u001b[31mError:\u001b[0m ${error?.message || 'Invalid timestamp'}` };
    }
  };

  // Command: md5 - Generate MD5 hash
  private md5Command = async (args: string[], _ctx?: ConsoleContext, _opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const text = args.join(' ');
    if (!text) {
      return { output: '\u001b[31mError:\u001b[0m Please provide text to hash' };
    }
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return { output: hash };
  };

  // Command: gen-login-id - Generate login-friendly user ID
  private genLoginIdCommand = async (_args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const length = opts?.length ? parseInt(opts.length, 10) : 12;
    const count = opts?.count ? parseInt(opts.count, 10) : 1;
    if (isNaN(length) || length < 6 || length > 32) {
      return { output: '\u001b[31mError:\u001b[0m Length must be between 6 and 32' };
    }
    if (isNaN(count) || count < 1 || count > 100) {
      return { output: '\u001b[31mError:\u001b[0m Count must be between 1 and 100' };
    }

    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const alnum = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const digits = '0123456789';

    const makeOne = (): string => {
      // First char: letter
      let out = letters[crypto.randomBytes(1)[0] % letters.length];
      // Ensure at least one digit in the remaining part
      const remaining = length - 1;
      const requiredDigitPos = remaining > 0 ? crypto.randomBytes(1)[0] % remaining : 0;
      for (let i = 0; i < remaining; i++) {
        if (i === requiredDigitPos) {
          out += digits[crypto.randomBytes(1)[0] % digits.length];
        } else {
          out += alnum[crypto.randomBytes(1)[0] % alnum.length];
        }
      }
      return out;
    };

    const lines: string[] = [];
    for (let i = 0; i < count; i++) lines.push(makeOne());
    return { output: lines.join('\n') };
  };

  // Command: gen-login-password - Generate login-friendly password
  private genLoginPasswordCommand = async (_args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const length = opts?.length ? parseInt(opts.length, 10) : 14;
    const count = opts?.count ? parseInt(opts.count, 10) : 1;
    if (isNaN(length) || length < 8 || length > 64) {
      return { output: '\u001b[31mError:\u001b[0m Length must be between 8 and 64' };
    }
    if (isNaN(count) || count < 1 || count > 100) {
      return { output: '\u001b[31mError:\u001b[0m Count must be between 1 and 100' };
    }

    const lettersLower = 'abcdefghijklmnopqrstuvwxyz';
    const lettersUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lettersAll = lettersLower + lettersUpper;
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}.,?';
    const pool = lettersAll + digits + symbols;

    const randFrom = (s: string) => s[crypto.randomBytes(1)[0] % s.length];

    const makeOne = (): string => {
      // First char must be a letter (upper/lower)
      let out = randFrom(lettersAll);
      const remaining = length - 1;

      // Ensure at least one digit and one symbol in the remaining part
      let chars: string[] = new Array(remaining).fill('');
      if (remaining >= 1) chars[0] = randFrom(digits);
      if (remaining >= 2) chars[1] = randFrom(symbols);
      for (let i = 0; i < remaining; i++) {
        if (!chars[i]) chars[i] = randFrom(pool);
      }
      // Shuffle remaining chars
      for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomBytes(1)[0] % (i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      out += chars.join('');
      return out;
    };

    const lines: string[] = [];
    for (let i = 0; i < count; i++) lines.push(makeOne());
    return { output: lines.join('\n') };
  };

  // Command: sha256 - Generate SHA256 hash
  private sha256Command = async (args: string[], _ctx?: ConsoleContext, _opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const text = args.join(' ');
    if (!text) {
      return { output: '\u001b[31mError:\u001b[0m Please provide text to hash' };
    }

    const hash = crypto.createHash('sha256').update(text).digest('hex');
    return { output: hash };
  };

  // Command: unixtimestamp - Get current Unix timestamp
  private unixtimestampCommand = async (_args: string[], _ctx?: ConsoleContext, opts?: Record<string, any>): Promise<ConsoleExecutionResult> => {
    const now = Date.now();

    if (opts?.ms) {
      return { output: String(now) };
    } else {
      return { output: String(Math.floor(now / 1000)) };
    }
  };


}

export const consoleService = new ConsoleService();
export default ConsoleService;

