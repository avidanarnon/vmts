import {
  Model,
  ModelStatus,
  ModelVisitor,
  Traversable,
  VisitResult,
} from './api';
import { VisitorLimiter } from './visitor-limiters';

/**
 * Visits model children only within the indicated limits.
 *
 *                    (0)
 * start = 1      (1) (1) (1)
 *              (2) (2) (2) (2)
 * end = 3    (3) (3) (3) (3) (3)
 *
 * start = -1|0       (0)
 *                  (1) (1)
 * end = 2        (2) (2) (2)
 *              (3) (3) (3) (3)
 *
 *                    (0)
 * start = 1        (1) (1)
 *                (2) (2) (2)
 * end = -1|3   (3) (3) (3) (3)
 */
abstract class StandardVisitor<T extends Model<any> & Traversable>
  implements ModelVisitor<T> {
  private currentDepth = -1;
  private _limiter: VisitorLimiter | undefined;

  constructor(limiter: VisitorLimiter | undefined) {
    this._limiter = limiter;
  }

  up(): void {
    this.currentDepth--;
  }

  down(): void {
    this.currentDepth++;
  }

  depth(): number {
    return this.currentDepth;
  }

  visit(model: T): VisitResult {
    if (!model) {
      return VisitResult.Continue;
    }

    let result = VisitResult.Continue;
    if (!this._limiter || this._limiter.shouldVisit(this, model)) {
      result = this.modelAllowedVisit(model);
    }

    return result;
  }

  protected abstract modelAllowedVisit(model: T): VisitResult;
}

export class ModelAcquireStatusVisitor extends StandardVisitor<
  Model<any> & Traversable
> {
  private statusFound = ModelStatus.None;

  get isChanged(): boolean {
    return !!(this.statusFound & ModelStatus.Changed);
  }

  get hasAdditions(): boolean {
    return !!(this.statusFound & ModelStatus.Added);
  }

  get hasDeletions(): boolean {
    return !!(this.statusFound & ModelStatus.Deleted);
  }

  get isNew(): boolean {
    return !!(this.statusFound & ModelStatus.New);
  }

  get isClean(): boolean {
    return (
      !this.isChanged && !this.hasAdditions && !this.hasDeletions && !this.isNew
    );
  }

  get isDirty(): boolean {
    return (
      this.isChanged || this.hasAdditions || this.hasDeletions || this.isNew
    );
  }

  get recursiveStatus(): number {
    return this.statusFound;
  }

  constructor(limiter: VisitorLimiter | undefined = undefined) {
    super(limiter);
  }

  protected modelAllowedVisit(o: Model<any> & Traversable): VisitResult {
    if (o as Model<any>) {
      const model = o as Model<any>;
      this.statusFound |= model.status();
    }
    return VisitResult.Continue;
  }
}

export class ModelIsDirtyVisitor<
  T extends Model<any> & Traversable
> extends StandardVisitor<T> {
  private modelIsDirty = false;

  get isDirty() {
    return this.modelIsDirty;
  }

  constructor(limiter: VisitorLimiter | undefined = undefined) {
    super(limiter);
  }

  protected modelAllowedVisit(o: T): VisitResult {
    if (o as Model<any>) {
      const model = o as Model<any>;
      if (model.status() !== 0) {
        this.modelIsDirty = true;
        return VisitResult.Finished;
      }
    }
    return VisitResult.Continue;
  }
}

export class ModelHasStatusVisitor<
  T extends Model<any> & Traversable
> extends StandardVisitor<T> {
  private _modelHasStatus = false;
  private searchStatus = ModelStatus.All;

  get modelHasStatus() {
    return this._modelHasStatus;
  }

  constructor(
    searchStatus: ModelStatus,
    limiter: VisitorLimiter | undefined = undefined
  ) {
    super(limiter);
    this.searchStatus = searchStatus;
  }

  protected modelAllowedVisit(o: T): VisitResult {
    if (o as Model<any>) {
      const model = o as Model<any>;
      if (model.status() & this.searchStatus) {
        this._modelHasStatus = true;
        return VisitResult.Finished;
      }
    }
    return VisitResult.Continue;
  }
}

export class GetChildrenWithStatusVisitor<
  T extends Model<any> & Traversable
> extends StandardVisitor<T> {
  private _childStatus = ModelStatus.All;
  private _childrenFound = new Array<T>();

  get children(): Array<T> {
    return this._childrenFound;
  }

  constructor(
    childStatus: ModelStatus,
    limiter: VisitorLimiter | undefined = undefined
  ) {
    super(limiter);
    this._childStatus = childStatus;
  }

  protected modelAllowedVisit(model: T): VisitResult {
    if (model.status() & this._childStatus) {
      this._childrenFound.push(model);
    }
    return VisitResult.Continue;
  }
}
