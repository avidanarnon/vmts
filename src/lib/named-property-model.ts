import { Observable, Subject } from 'rxjs';

import {
  Addable,
  Deletable,
  Model,
  ModelStatus,
  ModelVisitor,
  Traversable,
} from './api';
import { ModelProperty } from './model-property';

export abstract class NamedPropertyModel
  implements Model<string>, Traversable, Addable, Deletable {
  protected _isNew = false;
  protected _isAdded = false;
  protected _changedSubject: Subject<Model<any>>;
  protected _modelChanged: Observable<Model<any>>;

  protected _properties = new Map<string, Model<any> | Traversable>();

  value: string;

  get added(): boolean {
    return this._isAdded;
  }
  set added(v: boolean) {
    this._isAdded = v;
    if (v) {
      this.deleted = false;
    }
  }

  get deleted(): boolean {
    return this.getChild<ModelProperty<boolean>>('deleted').value;
  }
  set deleted(v: boolean) {
    if (v) {
      this.added = false;
    }
    this.getChild<ModelProperty<boolean>>('deleted').value = v;
  }

  get changed(): Observable<Model<string>> {
    return this._modelChanged;
  }

  constructor(name: string) {
    this._isNew = true;
    this.value = name;

    this._changedSubject = new Subject<Model<any>>();
    this._modelChanged = this._changedSubject.asObservable();

    this.addChild('deleted', new ModelProperty<boolean>());
    this.getChild<ModelProperty<boolean>>('deleted').load(false);
  }

  protected getChild<M extends Model<any>>(name: string): M {
    if (!this._properties.has(name)) {
      throw new Error('Unknown property ' + name);
    }
    return this._properties.get(name) as M;
  }

  protected addChild<M extends Model<any>>(name: string, child: M): void {
    if (this._properties.has(name)) {
      throw new Error('Property ' + name + ' already added to model');
    }
    child.changed.subscribe((model: Model<any>) => {
      if (this._changedSubject) {
        this._changedSubject.next(this);
      }
    });
    this._properties.set(name, child);
  }

  traverse(visitor: ModelVisitor<Traversable>): void {
    visitor.down();
    visitor.visit(this);
    for (const child of Array.from(this._properties.values())) {
      if (child as Model<any>) {
        const model = child as Traversable;
        model.traverse(visitor);
      }
    }
    visitor.up();
  }

  selfStatus(): ModelStatus {
    let selfStatus = ModelStatus.None;
    if (this.deleted) {
      selfStatus |= ModelStatus.Deleted;
    }
    if (this.added) {
      selfStatus |= ModelStatus.Added;
    }
    if (this._isNew) {
      selfStatus |= ModelStatus.New;
    }

    let propertyStatus = ModelStatus.None;
    for (const child of Array.from(this._properties.values())) {
      if (child as ModelProperty<any>) {
        propertyStatus |= (child as Model<any>).status();
      }
    }

    if (propertyStatus & ModelStatus.New) {
      // Don't include new from properties
      propertyStatus &= ModelStatus.New;
    }

    return selfStatus | propertyStatus;
  }

  status(): ModelStatus {
    let selfStatus = this.selfStatus();
    for (const child of Array.from(this._properties.values())) {
      if (child as Model<any>) {
        selfStatus |= (child as Model<any>).status();
      }
    }

    if (
      !!(selfStatus & ModelStatus.New) ||
      !!(selfStatus & ModelStatus.Deleted)
    ) {
      // New and Deleted takes precedent over changed
      selfStatus &= 0b1110;
    }

    return selfStatus;
  }

  commit(): boolean {
    this._isNew = false;
    this._isAdded = false;
    this.deleted = false;
    for (const val of Array.from(this._properties.values())) {
      if (val as Model<any>) {
        const property = val as Model<any>;
        property.commit();
      }
    }
    return true;
  }

  rollback(): boolean {
    for (const val of Array.from(this._properties.values())) {
      if (val as Model<any>) {
        const property = val as Model<any>;
        property.rollback();
      }
    }
    return true;
  }
}
