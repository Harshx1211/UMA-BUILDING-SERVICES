/** Records how long each pipeline stage took, in order — logged with every
 * generation so a slow report shows WHERE it was slow. */
export class StageTimer {
  private last = Date.now();
  private readonly parts: string[] = [];
  lap(stage: string): void {
    const now = Date.now();
    this.parts.push(`${stage}=${now - this.last}ms`);
    this.last = now;
  }
  toString(): string {
    return this.parts.join(' ');
  }
}
