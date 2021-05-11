import test from 'ava';

import {
  Model,
  ModelStatus,
  ModelVisitor,
  Traversable,
  VisitResult,
} from './api';
import { ModelProperty } from './model-property';
import { NamedPropertyModel } from './named-property-model';
import { ModelCollectionProperty } from './model-collection';

class TestingVisitor implements ModelVisitor<Model<any> & Traversable> {
  modelsVisited = new Array<Model<any>>();

  up(): void {}
  down(): void {}
  depth(): number {
    return 0;
  }

  visit(model: Model<any> & Traversable): VisitResult {
    if (model) {
      this.modelsVisited.push(model);
    }
    return VisitResult.Continue;
  }
}

class TestableModel extends NamedPropertyModel {
  get prop1(): boolean {
    return this.getChild<ModelProperty<boolean>>('prop1').value;
  }
  set prop1(v: boolean) {
    this.getChild<ModelProperty<boolean>>('prop1').value = v;
  }

  get prop2(): number {
    return this.getChild<ModelProperty<number>>('prop2').value;
  }
  set prop2(v: number) {
    this.getChild<ModelProperty<number>>('prop2').value = v;
  }

  constructor() {
    super('testable-model');

    this.addChild('prop1', new ModelProperty());
    this.addChild('prop2', new ModelProperty());
  }

  getProperty1(): Model<boolean> {
    return this.getChild<ModelProperty<boolean>>('prop1');
  }

  getProperty2(): Model<number> {
    return this.getChild<ModelProperty<number>>('prop2');
  }
}

class TestableCollection extends ModelCollectionProperty<TestableModel> {}

describe('ModelCollection initialization', () => {
  it('makes a new collection', () => {
    const collection = new TestableCollection();
    expect(collection.status()).toEqual(ModelStatus.New);
  });

  it('commit changes status to none', () => {
    const collection = new TestableCollection();
    collection.commit();
    expect(collection.status()).toEqual(ModelStatus.None);
  });

  it('collection is initialized with constructor', () => {
    const collection = new TestableCollection();
    expect(collection.value).toBeTruthy();
  });

  it('sets up change detection', () => {
    const collection = new TestableCollection();
    expect(collection.changed).toBeTruthy();
  });
});

describe('ModelCollection load', () => {
  it('loading ensures that all children are put into commited state', () => {
    const collection = new TestableCollection();
    const data = new Array<TestableModel>();
    const child = new TestableModel();
    child.commit();
    data.push(child);

    collection.load(data);

    expect(collection.status()).toEqual(ModelStatus.None);
  });

  it('populates the ko array properly', () => {
    const collection = new TestableCollection();
    const data = new Array<TestableModel>();
    data.push(new TestableModel());
    data.push(new TestableModel());
    data.push(new TestableModel());

    collection.load(data);

    expect(collection.value().length).toEqual(3);
  });
});

describe('ModelCollection status', () => {
  it('adding a child to the ko collection changes status to added', () => {
    const collection = new TestableCollection();
    collection.commit();

    expect(collection.status()).toEqual(
      ModelStatus.None,
      'Collection is unchanged and empty and should have None status'
    );
    collection.value.push(new TestableModel());
    expect(!!(collection.status() & ModelStatus.Added)).toBeTruthy(
      'Collection has a new child model added so it should be Added '
    );
  });

  it('removing a child from the ko collection changes the status to removed', () => {
    const collection = new TestableCollection();
    const newChild = new TestableModel();
    collection.value.push(newChild);
    collection.commit();

    collection.value.remove(newChild);
    expect(collection.status()).toEqual(ModelStatus.Deleted);
  });
});

describe('ModelCollection remove', () => {
  it('removing from commited model leaves model with deleted status', () => {
    const collection = new TestableCollection();

    const child = new TestableModel();
    child.prop1 = true;
    child.prop2 = 1;
    child.commit();

    collection.load([child]);
    collection.commit();

    expect(collection.status()).toEqual(ModelStatus.None);

    collection.value.remove(child);

    expect(collection.status()).toEqual(ModelStatus.Deleted);
  });
});

describe('ModelCollection changed', () => {
  it('notifies when adding items to ko array', () => {
    const collection = new TestableCollection();
    collection.commit();

    let calls = 0;
    collection.changed.subscribe((model) => {
      if (calls === 0) {
        expect(model.value().length).toEqual(1);
      } else if (calls === 1) {
        expect(model.value().length).toEqual(2);
      } else if (calls === 2) {
        expect(model.value().length).toEqual(1);
      } else if (calls === 3) {
        expect(model.value().length).toEqual(0);
      }
      calls++;
    });

    const m1 = new TestableModel();
    const m2 = new TestableModel();
    collection.value.push(m1);
    collection.value.push(m2);
    collection.value.remove(m2);
    collection.value.remove(m1);
  });
});

describe('ModelCollection traverse', () => {
  it('with empty collection only visits the collection', () => {
    const collection = new TestableCollection();
    const visitor = new TestingVisitor();
    collection.traverse(visitor);

    expect(visitor.modelsVisited.length).toEqual(1);
    expect(visitor.modelsVisited[0]).toEqual(collection);
  });

  it('with filled collection visits all collection contents and children of those', () => {
    const collection = new TestableCollection();
    collection.value.push(new TestableModel());

    const visitor = new TestingVisitor();
    collection.traverse(visitor);

    expect(visitor.modelsVisited.length).toEqual(5);
  });

  it('with filled collection gives different number of visits than the collection with contents removed', () => {
    const collection = new TestableCollection();
    collection.value.push(new TestableModel());

    const visitor = new TestingVisitor();
    collection.traverse(visitor);

    expect(visitor.modelsVisited.length).toEqual(5);

    collection.value.removeAll();

    const visitor2 = new TestingVisitor();
    collection.traverse(visitor2);
    expect(visitor2.modelsVisited.length).toEqual(1);
  });
});
