import {
  Model,
  ModelStatus,
  ModelVisitor,
  Traversable,
  VisitResult,
} from '../lib/api';
import { ModelProperty } from '../lib/model-property';
import { NamedPropertyModel } from '../lib/named-property-model';

class TestableVisitor implements ModelVisitor<Model<any> & Traversable> {
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

class TestModel extends NamedPropertyModel {
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

  get prop3(): string {
    return this.getChild<ModelProperty<string>>('prop3').value;
  }
  set prop3(v: string) {
    this.getChild<ModelProperty<string>>('prop3').value = v;
  }

  constructor() {
    super('test-model');

    this.addChild('prop1', new ModelProperty());
    this.addChild('prop2', new ModelProperty());
    this.addChild('prop3', new ModelProperty());
  }

  getProperty1(): Model<boolean> {
    return this.getChild<ModelProperty<boolean>>('prop1');
  }

  getProperty2(): Model<number> {
    return this.getChild<ModelProperty<number>>('prop2');
  }

  getProperty3(): Model<string> {
    return this.getChild<ModelProperty<string>>('prop3');
  }
}

class NestedModel extends NamedPropertyModel {
  get property(): string {
    return this.getChild<ModelProperty<string>>('property').value;
  }
  set property(v: string) {
    this.getChild<ModelProperty<string>>('property').value = v;
  }

  get nested(): TestModel {
    return this.getChild<TestModel>('nested');
  }
  set nested(v: TestModel) {
    const childModel = this.getChild<TestModel>('nested');
    childModel.prop1 = v.prop1;
    childModel.prop2 = v.prop2;
    childModel.prop3 = v.prop3;
  }

  constructor() {
    super('nested-model');

    this.addChild('property', new ModelProperty());
    this.addChild('nested', new TestModel());
  }

  getProperty(): Model<boolean> {
    return this.getChild<any>('property');
  }

  getModel(): TestModel {
    return this.getChild<TestModel>('nested');
  }
}

test('work as expected with boolean property', () => {
  const model = new TestModel();
  model.prop1 = true;
  expect(model.prop1).toBeTruthy();
});

test('work as expected with numeric property', () => {
  const model = new TestModel();
  model.prop2 = 9;
  expect(model.prop2).toBe(9);
});

test('work as expected with string property', () => {
  const model = new TestModel();
  model.prop3 = '9';
  expect(model.prop3).toBe('9');
});

test('with new model marks it as none status', () => {
  const model = new TestModel();
  model.commit();
  expect(model.status()).toBe(ModelStatus.None);
});

test('twice with new model marks it as none status', () => {
  const model = new TestModel();
  model.commit();
  model.commit();
  expect(model.status()).toBe(ModelStatus.None);
});

test('model with property changes marks it as none and all children are also committed', () => {
  const model = new TestModel();
  model.prop1 = true;
  model.commit();
  expect(model.status()).toBe(ModelStatus.None);
  expect(model.getProperty1().status()).toBe(ModelStatus.None);
});

test('model with multiple property changes marks it as none and all children are also committed', () => {
  const model = new TestModel();
  model.prop1 = true;
  model.prop2 = 9;
  model.prop3 = '9';

  model.commit();

  expect(model.status()).toBe(ModelStatus.None);
  expect(model.getProperty1().status()).toBe(ModelStatus.None);
  expect(model.getProperty2().status()).toBe(ModelStatus.None);
  expect(model.getProperty3().status()).toBe(ModelStatus.None);
});

test('new object as new', () => {
  const model = new TestModel();
  expect(model.status()).toBe(ModelStatus.New);
});

test('new object initializes its own change observer', () => {
  const model = new TestModel();
  expect(model.changed).toBeTruthy();
});

test('new object initializes all properties as undefined', () => {
  const model = new TestModel();
  expect(model.prop1).toBeFalsy();
  expect(model.prop2).toBeFalsy();
  expect(model.prop3).toBeFalsy();
});

test('marking the model as deleted changes the status to deleted', () => {
  const model = new TestModel();
  model.deleted = true;
  expect(!!(model.status() & ModelStatus.Deleted)).toBeTruthy();
});

test('making a new property marks its status as new', () => {
  const model = new TestModel();
  expect(!!(model.status() & ModelStatus.New)).toBeTruthy();
});

test('the subject is propagated to the child properties', () => {
  let updateNumber = 0;
  const model = new TestModel();
  model.changed.subscribe((changedModel) => {
    if (updateNumber === 0) {
      expect((changedModel as TestModel).prop1).toBe(true);
    } else if (updateNumber === 1) {
      expect((changedModel as TestModel).prop2).toBe(0);
    } else if (updateNumber === 2) {
      expect((changedModel as TestModel).prop3).toBe('');
    }

    updateNumber++;
  });

  model.prop1 = true;
  model.prop2 = 0;
  model.prop3 = '';
});

test('visits all children', () => {
  const model = new TestModel();
  const visitor = new TestableVisitor();

  model.traverse(visitor);

  expect(visitor.modelsVisited.indexOf(model) >= 0).toBeTruthy();
  expect(visitor.modelsVisited.indexOf(model.getProperty1()) >= 0).toBeTruthy();
  expect(visitor.modelsVisited.indexOf(model.getProperty2()) >= 0).toBeTruthy();
  expect(visitor.modelsVisited.indexOf(model.getProperty3()) >= 0).toBeTruthy();
});

test('visits all nested children', () => {
  const model = new NestedModel();
  const visitor = new TestableVisitor();

  model.traverse(visitor);

  expect(visitor.modelsVisited.length).toBe(8);
  expect(visitor.modelsVisited.indexOf(model) >= 0).toBeTruthy();
  expect(visitor.modelsVisited.indexOf(model.getProperty()) >= 0).toBeTruthy();
  expect(visitor.modelsVisited.indexOf(model.getModel()) >= 0).toBeTruthy();
  expect(
    visitor.modelsVisited.indexOf(model.getModel().getProperty1()) >= 0
  ).toBeTruthy();
  expect(
    visitor.modelsVisited.indexOf(model.getModel().getProperty2()) >= 0
  ).toBeTruthy();
  expect(
    visitor.modelsVisited.indexOf(model.getModel().getProperty3()) >= 0
  ).toBeTruthy();
});
