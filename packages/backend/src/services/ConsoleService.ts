import logger from '../config/logger';
import { randomUUID } from 'crypto';

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
  action: (args: string[], ctx?: ConsoleContext, opts?: Record<string, any>) => Promise<ConsoleExecutionResult>;
}

class CommandBuilder {
  private def: BuiltCommandDef;
  constructor(name: string, private onBuild: (def: BuiltCommandDef) => void) {
    this.def = { name, action: async () => ({ output: '' }) } as BuiltCommandDef;
  }
  description(desc: string) { this.def.description = desc; return this; }
  option(flag: string, description: string) {
    if (!this.def.options) this.def.options = [];
    this.def.options.push({ flag, description });
    return this;
  }
  action(fn: BuiltCommandDef['action']) { this.def.action = fn; return this; }
  register() { this.onBuild(this.def); return this; }
}

class ConsoleService {
  private legacyHandlers: Map<string, ConsoleCommandHandler> = new Map();
  private descriptions: Map<string, string> = new Map();
  private builtCommands: Map<string, BuiltCommandDef> = new Map();

  public command(name: string) {
    return new CommandBuilder(name, (def) => {
      this.builtCommands.set(def.name, def);
      if (def.description) this.descriptions.set(def.name, def.description);
    });
  }

  public register(name: string, handler: ConsoleCommandHandler, description?: string) {
    this.legacyHandlers.set(name, handler);
    if (description) this.descriptions.set(name, description);
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
    this.register('base64', this.base64Command, 'Encode/Decode base64 text: base64 --encode <text> | base64 --decode <b64>');
    this.register('health', this.healthCommand, 'Server health check');

    // Builder-style (commander-like) registrations
    this.command('whoami')
      .description('Display current user information')
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
      .register()
      .action(async (args) => this.echoCommand(args));

    this.command('base64')
      .description('Base64 encode/decode')
      .option('--encode', 'Encode text to base64')
      .option('--decode', 'Decode base64 to text')
      .register()
      .action(async (args) => this.base64Command(args));
  }



  public listCommands(): string[] {
    return Array.from(new Set([
      ...Array.from(this.legacyHandlers.keys()),
      ...Array.from(this.builtCommands.keys()),
      ...Array.from(this.descriptions.keys()),
    ])).sort();
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

  // Built-in: help (commander-like)
  private helpCommand = async (): Promise<ConsoleExecutionResult> => {
    const header = [
      '\u001b[1mUsage:\u001b[0m',
      '  command [options] [arguments]',
      '',
      '\u001b[1mCommands:\u001b[0m',
    ];
    const entries = this.listCommands().map((name) => {
      const desc = this.descriptions.get(name) || '';
      const optLines: string[] = [];
      const built = this.builtCommands.get(name);
      if (built?.options?.length) {
        for (const o of built.options) optLines.push(`      ${o.flag.padEnd(12)} ${o.description}`);
      }
      const base = `  \u001b[36m${name}\u001b[0m  ${desc}`;
      return [base, ...optLines].join('\n');
    });
    return { output: [...header, ...entries].join('\n') };
  };

  // Built-in: echo
  private echoCommand = async (args: string[]): Promise<ConsoleExecutionResult> => {
    // Color flags: --red, --green, --yellow, --blue, --magenta, --cyan, --white
    const colorMap: Record<string, string> = {
      '--red': '\u001b[31m',
      '--green': '\u001b[32m',
      '--yellow': '\u001b[33m',
      '--blue': '\u001b[34m',
      '--magenta': '\u001b[35m',
      '--cyan': '\u001b[36m',
      '--white': '\u001b[37m',
    };
    let color = '';
    const rest: string[] = [];
    for (const a of args) {
      if (colorMap[a]) color = colorMap[a]; else rest.push(a);
    }
    const text = rest.join(' ');
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
  private base64Command = async (args: string[]): Promise<ConsoleExecutionResult> => {
    const hasEncode = args.includes('--encode');
    const hasDecode = args.includes('--decode');
    const rest = args.filter(a => a !== '--encode' && a !== '--decode');
    const text = rest.join(' ');
    if (hasEncode && !hasDecode) {
      return { output: Buffer.from(text, 'utf-8').toString('base64') };
    }
    if (hasDecode && !hasEncode) {
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
}

export const consoleService = new ConsoleService();
export default ConsoleService;

