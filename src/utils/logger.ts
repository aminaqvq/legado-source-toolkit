import pc from 'picocolors';

let verbose = true;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function info(msg: string): void {
  if (!verbose) return;
  console.log(pc.blue('ℹ'), msg);
}

export function success(msg: string): void {
  if (!verbose) return;
  console.log(pc.green('✔'), msg);
}

export function warn(msg: string): void {
  if (!verbose) return;
  console.warn(pc.yellow('⚠'), msg);
}

export function error(msg: string): void {
  console.error(pc.red('✖'), msg);
}

export function progress(current: number, total: number, label: string): void {
  if (!verbose) return;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  process.stderr.write(`\r${pc.cyan('⏳')} [${pct}%] ${label} ${current}/${total}`);
  if (current >= total) {
    process.stderr.write('\n');
  }
}

export function heading(msg: string): void {
  if (!verbose) return;
  console.log(`\n${pc.bold(pc.cyan('━━━'))} ${pc.bold(msg)} ${pc.bold(pc.cyan('━━━'))}`);
}

export function keyValue(key: string, val: string | number): void {
  if (!verbose) return;
  console.log(`  ${pc.dim(key)}: ${pc.white(String(val))}`);
}
