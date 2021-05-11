import { Observable } from 'rxjs';

export enum ModelStatus {
  /**
   * None = 0000
   */
  None = 0,
  /**
   * Changed = 0001
   */
  Changed = 1 << 0,
  /**
   * Added = 0010
   */
  Added = 1 << 1,
  /**
   * Deleted = 0100
   */
  Deleted = 1 << 2,
  /**
   * New = 1000
   */
  New = 1 << 3,
  /**
   * All = 1111
   */
  All = ~(~0 << 4),
}

export interface Addable {
  added: boolean;
}

export interface Deletable {
  deleted: boolean;
}

export interface Traversable {
  traverse(visitor: ModelVisitor<Traversable>): void;
}

export interface Model<V> {
  value: V;
  changed: Observable<Model<V>>;

  status(): ModelStatus;

  commit(): boolean;
  rollback(): boolean;
}

export function LoadModel<V>(m: Model<V>, v: V) {
  m.value = v;
  m.commit();
}

export enum VisitResult {
  Continue,
  Finished,
}

export interface ModelVisitor<T extends Model<any> | Traversable> {
  up(): void;
  down(): void;
  depth(): number;
  visit(model: T): VisitResult;
}
