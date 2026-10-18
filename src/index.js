#!/usr/bin/env node
import { Cli } from "./cli.js";

process.exitCode = await new Cli().start(process.argv.slice(2));
