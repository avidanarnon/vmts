import {
  Model,
  ModelStatus,
  ModelVisitor,
  Traversable,
  VisitResult,
} from './api';
import { ModelCollectionProperty } from './model-collection';
import { ModelProperty } from './model-property';
import { NamedPropertyModel } from './named-property-model';

class TestingVisitor implements ModelVisitor<Model<any> & Traversable> {
  modelsVisited = new Array<Model<any>>();

  up(): void {
    return;
  }
  down(): void {
    return;
  }
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

test('makes a new collection', () => {
  const collection = new TestableCollection();
  expect(collection.status()).toBe(ModelStatus.New);
});

test('commit changes status to none', () => {
  const collection = new TestableCollection();
  collection.commit();
  expect(collection.status()).toBe(ModelStatus.None);
});

test('collection is initialized with constructor', () => {
  const collection = new TestableCollection();
  expect(collection.value).toBeTruthy();
});

test('sets up change detection', () => {
  const collection = new TestableCollection();
  expect(collection.changed).toBeTruthy();
});

test('loading ensures that all children are put into committed state', () => {
  const collection = new TestableCollection();
  const data = new Array<TestableModel>();
  const child = new TestableModel();
  child.commit();
  data.push(child);

  collection.load(data);

  expect(collection.status()).toBe(ModelStatus.None);
});

test('populates the ko array properly', () => {
  const collection = new TestableCollection();
  const data = new Array<TestableModel>();
  data.push(new TestableModel());
  data.push(new TestableModel());
  data.push(new TestableModel());

  collection.load(data);

  expect(collection.value().length).toBe(3);
});

test('adding a child to the ko collection changes status to added', () => {
  const collection = new TestableCollection();
  collection.commit();

  expect(collection.status()).toBe(ModelStatus.None);
  collection.value.push(new TestableModel());
  expect(!!(collection.status() & ModelStatus.Added)).toBeTruthy();
});

test('removing a child from the ko collection changes the status to removed', () => {
  const collection = new TestableCollection();
  const newChild = new TestableModel();
  collection.value.push(newChild);
  collection.commit();

  collection.value.remove(newChild);
  expect(collection.status()).toBe(ModelStatus.Deleted);
});

test('removing from committed model leaves model with deleted status', () => {
  const collection = new TestableCollection();

  const child = new TestableModel();
  child.prop1 = true;
  child.prop2 = 1;
  child.commit();

  collection.load([child]);
  collection.commit();

  expect(collection.status()).toBe(ModelStatus.None);

  collection.value.remove(child);

  expect(collection.status()).toBe(ModelStatus.Deleted);
});

test('notifies when adding items to ko array', () => {
  const collection = new TestableCollection();
  collection.commit();

  let calls = 0;
  collection.changed.subscribe((model) => {
    if (calls === 0) {
      expect(model.value().length).toBe(1);
    } else if (calls === 1) {
      expect(model.value().length).toBe(2);
    } else if (calls === 2) {
      expect(model.value().length).toBe(1);
    } else if (calls === 3) {
      expect(model.value().length).toBe(0);
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

test('with empty collection only visits the collection', () => {
  const collection = new TestableCollection();
  const visitor = new TestingVisitor();
  collection.traverse(visitor);

  expect(visitor.modelsVisited.length).toBe(1);
  expect(visitor.modelsVisited[0]).toBe(collection);
});

test('with filled collection visits all collection contents and children of those', () => {
  const collection = new TestableCollection();
  collection.value.push(new TestableModel());

  const visitor = new TestingVisitor();
  collection.traverse(visitor);

  expect(visitor.modelsVisited.length).toBe(5);
});

test('with filled collection gives different number of visits than the collection with contents removed', () => {
  const collection = new TestableCollection();
  collection.value.push(new TestableModel());

  const visitor = new TestingVisitor();
  collection.traverse(visitor);

  expect(visitor.modelsVisited.length).toBe(5);

  collection.value.removeAll();

  const visitor2 = new TestingVisitor();
  collection.traverse(visitor2);
  expect(visitor2.modelsVisited.length).toBe(1);
});
