import { Model, ModelStatus, Traversable } from './api';
import { DepthLimiter, TypeLimiter } from './visitor-limiters';
import {
  GetChildrenWithStatusVisitor,
  ModelAcquireStatusVisitor,
  ModelHasStatusVisitor,
  ModelIsDirtyVisitor,
} from './visitors';

export function findChildrenWithStatus<T extends Model<any> & Traversable>(
  status: ModelStatus,
  model: Traversable,
  start?: number,
  end?: number
): Array<T> {
  let limiter: DepthLimiter | undefined;
  if (start && end) {
    limiter = new DepthLimiter(start, end);
  }
  const visitor = new GetChildrenWithStatusVisitor<T>(status, limiter);
  model.traverse(visitor);
  return visitor.children;
}

export function findChildrenByTypeWithStatus(
  status: ModelStatus,
  model: Traversable,
  type: any
): Array<Model<any>> {
  const limiter = new TypeLimiter(type);
  const visitor = new GetChildrenWithStatusVisitor(status, limiter);
  model.traverse(visitor);
  return visitor.children;
}

export function getModelStatusRecursive(
  model: Model<any> & Traversable,
  start?: number,
  end?: number
): number {
  let limiter: DepthLimiter | undefined;
  if (start && end) {
    limiter = new DepthLimiter(start, end);
  }
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);
  return visitor.recursiveStatus;
}

export function modelIsDirty<T extends Model<any> & Traversable>(
  model: T,
  start?: number,
  end?: number
): boolean {
  let limiter: DepthLimiter | undefined;
  if (start && end) {
    limiter = new DepthLimiter(start, end);
  }
  const visitor = new ModelIsDirtyVisitor(limiter);
  model.traverse(visitor);
  return visitor.isDirty;
}

export function modelHasStatus<T extends Model<any> & Traversable>(
  status: ModelStatus,
  model: T,
  start?: number,
  end?: number
): boolean {
  let limiter: DepthLimiter | undefined;
  if (start && end) {
    limiter = new DepthLimiter(start, end);
  }
  const visitor = new ModelHasStatusVisitor(status, limiter);
  model.traverse(visitor);
  return visitor.modelHasStatus;
}

export function findStatusOfChildrenOfType(model: Traversable, type: any) {
  const limiter = new TypeLimiter(type);
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);
  return visitor;
}
