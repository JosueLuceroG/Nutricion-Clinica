let transitionDepth = 0;

export function isLocalContextTransitioning(): boolean {
  return transitionDepth > 0;
}

export function enterLocalContextTransition(): void {
  transitionDepth += 1;
}

export function leaveLocalContextTransition(): void {
  transitionDepth = Math.max(0, transitionDepth - 1);
}
