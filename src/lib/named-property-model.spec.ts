import test from 'ava';

import {
  Model,
  ModelStatus,
  ModelVisitor,
  VisitResult,
  Traversable,
} from './api';
import { ModelProperty } from './model-property';
import { NamedPropertyModel } from './named-property-model';

class TestableVisitor implements ModelVisitor<Model<any> & Traversable> {
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

test('work as expected with boolean property', (t) => {
  const model = new TestModel();
  model.prop1 = true;
  t.true(model.prop1);
});

test('work as expected with numeric property', (t) => {
  const model = new TestModel();
  model.prop2 = 9;
  t.is(model.prop2, 9);
});

test('work as expected with string property', (t) => {
  const model = new TestModel();
  model.prop3 = '9';
  t.is(model.prop3, '9');
});

test('with new model marks it as none status', (t) => {
  const model = new TestModel();
  model.commit();
  t.is(model.status(), ModelStatus.None);
});

test('twice with new model marks it as none status', (t) => {
  const model = new TestModel();
  model.commit();
  model.commit();
  t.is(model.status(), ModelStatus.None);
});

test('model with property changes marks it as none and all children are also commited', (t) => {
  const model = new TestModel();
  model.prop1 = true;
  model.commit();
  t.is(model.status(), ModelStatus.None);
  t.is(model.getProperty1().status(), ModelStatus.None);
});

test('model with multiple property changes marks it as none and all children are also commited', (t) => {
  const model = new TestModel();
  model.prop1 = true;
  model.prop2 = 9;
  model.prop3 = '9';

  model.commit();

  t.is(model.status(), ModelStatus.None);
  t.is(model.getProperty1().status(), ModelStatus.None);
  t.is(model.getProperty2().status(), ModelStatus.None);
  t.is(model.getProperty3().status(), ModelStatus.None);
});

test('new object as new', (t) => {
  const model = new TestModel();
  t.is(model.status(), ModelStatus.New);
});

test('new object initializes its own change observer', (t) => {
  const model = new TestModel();
  t.true(model.changed);
});

test('new object initializes all properties as undefined', (t) => {
  const model = new TestModel();
  t.false(model.prop1);
  t.false(model.prop2);
  t.false(model.prop3);
});

test('marking the model as deleted changes the status to deleted', (t) => {
  const model = new TestModel();
  model.deleted = true;
  t.true(!!(model.status() & ModelStatus.Deleted));
});

test('making a new property marks its status as new', (t) => {
  const model = new TestModel();
  t.true(!!(model.status() & ModelStatus.New));
});

test('the subject is propagated to the child properties', (t) => {
  let updateNumber = 0;
  const model = new TestModel();
  model.changed.subscribe((changedModel) => {
    if (updateNumber === 0) {
      t.is((changedModel as TestModel).prop1, true);
    } else if (updateNumber === 1) {
      t.is((changedModel as TestModel).prop2, 0);
    } else if (updateNumber === 2) {
      t.is((changedModel as TestModel).prop3, '');
    }

    updateNumber++;
  });

  model.prop1 = true;
  model.prop2 = 0;
  model.prop3 = '';
});

test('visits all children', (t) => {
  const model = new TestModel();
  const visitor = new TestableVisitor();

  model.traverse(visitor);

  t.true(visitor.modelsVisited.indexOf(model) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getProperty1()) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getProperty2()) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getProperty3()) >= 0);
});

test('visits all nested children', (t) => {
  const model = new NestedModel();
  const visitor = new TestableVisitor();

  model.traverse(visitor);

  t.is(visitor.modelsVisited.length, 8);
  t.true(visitor.modelsVisited.indexOf(model) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getProperty()) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getModel()) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getModel().getProperty1()) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getModel().getProperty2()) >= 0);
  t.true(visitor.modelsVisited.indexOf(model.getModel().getProperty3()) >= 0);
});
