export class Grid<T> {
  readonly width: number;
  readonly height: number;
  private readonly cells: T[];

  constructor(width: number, height: number, fill: T) {
    if (width <= 0 || height <= 0) {
      throw new RangeError(
        `Grid dimensions must be positive: ${width}x${height}`,
      );
    }
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(fill);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): T {
    if (!this.inBounds(x, y)) {
      throw new RangeError(`Grid out of bounds: (${x}, ${y})`);
    }
    return this.cells[y * this.width + x];
  }

  set(x: number, y: number, value: T): void {
    if (!this.inBounds(x, y)) {
      throw new RangeError(`Grid out of bounds: (${x}, ${y})`);
    }
    this.cells[y * this.width + x] = value;
  }

  fill(value: T): void {
    this.cells.fill(value);
  }

  forEach(callback: (value: T, x: number, y: number) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        callback(this.cells[y * this.width + x], x, y);
      }
    }
  }
}
