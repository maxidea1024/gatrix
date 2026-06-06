#!/usr/bin/env node

import { Command } from 'commander';
import { registerSourcemapsCommand } from './commands/sourcemaps-upload';

const program = new Command();

program
  .name('argus-cli')
  .description('Argus CLI — Source map upload and project management')
  .version('1.0.0');

// Register sub-commands
registerSourcemapsCommand(program);

program.parse(process.argv);
