import * as ko from 'knockout';
import { Observable, Subject } from 'rxjs';

import {
  Addable,
  Deletable,
  Model,
  ModelStatus,
  ModelVisitor,
  Traversable,
} from './api';

export class ModelCollectionProperty<
  P extends Model<any> & Traversable & Deletable & Addable
> implements Model<KnockoutObservableArray<P>>, Traversable {
  private _isNew: boolean;

  protected _changedSubject: Subject<Model<any>>;
  private _modelChanged: Observable<Model<any>>;

  private _collection: KnockoutObservableArray<P>;
  private _added = new Array<P>();
  private _removed = new Array<P>();

  get changed(): Observable<Model<KnockoutObservableArray<P>>> {
    return this._modelChanged;
  }

  get value(): KnockoutObservableArray<P> {
    return this._collection;
  }

  set value(v: KnockoutObservableArray<P>) {
    throw new Error('Method not implemented.');
  }

  constructor() {
    this._isNew = true;
    this._changedSubject = new Subject<Model<any>>();
    this._modelChanged = this._changedSubject.asObservable();

    this._collection = ko.observableArray([]);
    this._collection.subscribe(this.onCollectionChanged, this, 'arrayChange');
  }

  private onCollectionChanged(changes: KnockoutArrayChange<P>[]) {
    for (const change of changes) {
      const model = change.value;
      const isNew = !!(model.status() & ModelStatus.New);
      if (change.status === 'added') {
        if (model as Addable) {
          (model as Addable).added = true;
        }
        this._added.push(change.value);
      } else if (change.status === 'deleted') {
        if (model as Addable) {
          (model as Addable).added = false;
        }
        if (!isNew) {
          if (model as Deletable) {
            (model as Deletable).deleted = true;
          }
          this._removed.push(change.value);
        }

        const indexOfAddedModel = this._added.indexOf(model);
        if (indexOfAddedModel >= 0) {
          this._added.splice(indexOfAddedModel, 1);
        }
      }
    }
    this._changedSubject.next(this);
  }

  load(items: Array<P>): void {
    this._isNew = false;
    for (const item of items) {
      this._collection.push(item);
    }

    this.commit();
  }

  traverse(visitor: ModelVisitor<ModelCollectionProperty<P>>): void {
    visitor.down();
    visitor.visit(this);
    for (const model of this._collection()) {
      if (model as Traversable) {
        const traverse = model as Traversable;
        traverse.traverse(visitor);
      }
    }

    for (const model of this._removed) {
      if (model as Traversable) {
        const traverse = model as Traversable;
        traverse.traverse(visitor);
      }
    }

    visitor.up();
  }

  status(): ModelStatus {
    let status = ModelStatus.None;
    if (this._added.length > 0) {
      status |= ModelStatus.Added;
    }
    if (this._removed.length > 0) {
      status |= ModelStatus.Deleted;
    }
    if (this._isNew) {
      status |= ModelStatus.New;
    }

    for (const child of this._collection()) {
      if (child as Model<any>) {
        const model = child as Model<any>;
        status |= model.status();
      }
    }

    return status;
  }

  commit(): boolean {
    this._isNew = false;
    this._added = new Array<P>();
    this._removed = new Array<P>();
    for (const val of this._collection()) {
      if (val as Model<any>) {
        const model = val as Model<any>;
        model.commit();
      }
    }
    return true;
  }

  rollback(): boolean {
    this._added = new Array<P>();
    this._removed = new Array<P>();
    for (const val of this._collection()) {
      if (val as Model<any>) {
        const model = val as Model<any>;
        model.rollback();
      }
    }
    return true;
  }
}
