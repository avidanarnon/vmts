import { Observable, Subject } from 'rxjs';

import { Model, ModelStatus, ModelVisitor, Traversable } from './api';

export class ModelProperty<T> implements Model<T>, Traversable {
  protected _isNew: boolean;
  private _currentValue: any;
  private _commitedValue: any;

  protected _changedSubject: Subject<Model<any>>;
  private _modelChanged: Observable<Model<any>>;

  get changed(): Observable<Model<T>> {
    return this._modelChanged;
  }

  get value(): T {
    return this._currentValue !== undefined
      ? this._currentValue
      : this._commitedValue;
  }

  set value(v: T) {
    this._currentValue = v;
    if (this._changedSubject) {
      this._changedSubject.next(this);
    }
  }

  constructor() {
    this._isNew = true;
    this._changedSubject = new Subject<Model<any>>();
    this._modelChanged = this._changedSubject.asObservable();
  }

  load(value: T) {
    this._isNew = false;
    this._commitedValue = value;
  }

  traverse(visitor: ModelVisitor<ModelProperty<T>>): void {
    visitor.down();
    visitor.visit(this);
    visitor.up();
  }

  status(): ModelStatus {
    let status = ModelStatus.None;
    if (
      this._currentValue !== undefined &&
      this._currentValue !== this._commitedValue
    ) {
      status |= ModelStatus.Changed;
    }
    if (this._isNew) {
      status |= ModelStatus.New;
    }
    return status;
  }

  commit(): boolean {
    this._isNew = false;
    if (this._currentValue !== undefined) {
      this._commitedValue = this._currentValue;
      this._currentValue = undefined;
    }
    return true;
  }

  rollback(): boolean {
    this._currentValue = undefined;
    if (this._changedSubject) {
      this._changedSubject.next(this);
    }
    return true;
  }
}
