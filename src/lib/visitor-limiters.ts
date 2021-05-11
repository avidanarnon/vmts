import { Model, ModelVisitor } from './api';

export interface VisitorLimiter {
  shouldVisit(visitor: ModelVisitor<any>, model: Model<any>): boolean;
}

export class DepthLimiter implements VisitorLimiter {
  private recurseStart = -1;
  private recurseEnd = -1;

  constructor(start?: number, end?: number) {
    if (start) {
      this.recurseStart = start;
    }
    if (end) {
      this.recurseEnd = end;
    }
  }

  shouldVisit(visitor: ModelVisitor<any>, model: Model<any>): boolean {
    const meetsStartCondition =
      this.recurseStart < 0 || visitor.depth() >= this.recurseStart;
    const meetsStopCondition =
      this.recurseEnd < 0 || visitor.depth() <= this.recurseEnd;

    if (meetsStartCondition && meetsStopCondition) {
      return true;
    }

    return false;
  }
}

export class TypeLimiter implements VisitorLimiter {
  private type: Function;
  constructor(type: Function) {
    this.type = type;
  }

  shouldVisit(visitor: ModelVisitor<any>, model: Model<any>): boolean {
    if (model instanceof this.type) {
      return true;
    }
    return false;
  }
}
