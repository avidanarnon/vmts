import test from 'ava';

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
import { DepthLimiter, TypeLimiter } from './visitor-limiters';
import {
  GetChildrenWithStatusVisitor,
  ModelAcquireStatusVisitor,
  ModelHasStatusVisitor,
  ModelIsDirtyVisitor,
} from './visitors';

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

class TestableModel2 extends NamedPropertyModel {
  get string(): string {
    return this.getChild<ModelProperty<string>>('string').value;
  }
  set string(v: string) {
    this.getChild<ModelProperty<string>>('string').value = v;
  }

  constructor(name?: string) {
    super(name ? name : 'testable2-model');
    this.addChild('string', new ModelProperty());
  }

  getStringProperty() {
    return this.getChild<ModelProperty<string>>('string');
  }
}

class TestableModel extends NamedPropertyModel {
  get boolean(): boolean {
    return this.getChild<ModelProperty<boolean>>('boolean').value;
  }
  set boolean(v: boolean) {
    this.getChild<ModelProperty<boolean>>('boolean').value = v;
  }

  get number(): number {
    return this.getChild<ModelProperty<number>>('number').value;
  }
  set number(v: number) {
    this.getChild<ModelProperty<number>>('number').value = v;
  }

  get collection(): KnockoutObservableArray<TestableModel2> {
    return this.getChild<ModelCollectionProperty<TestableModel2>>('collection')
      .value;
  }

  constructor() {
    super('testable-model');

    this.addChild('boolean', new ModelProperty());
    this.addChild('number', new ModelProperty());
    this.addChild('collection', new ModelCollectionProperty<TestableModel2>());
  }

  getBooleanProperty() {
    return this.getChild<ModelProperty<boolean>>('boolean');
  }

  getNumberProperty() {
    return this.getChild<ModelProperty<number>>('number');
  }

  getCollectionProperty() {
    return this.getChild<ModelCollectionProperty<TestableModel2>>('collection');
  }
}

test('with commited model gives clean status', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();

  const visitor = new ModelAcquireStatusVisitor();
  model.traverse(visitor);

  t.true(visitor.isClean);
  t.false(visitor.isDirty);
});

test('with model with collection that has pending addition gives add status', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const visitor = new ModelAcquireStatusVisitor();
  model.traverse(visitor);

  t.false(visitor.isClean);
  t.true(visitor.isDirty);
  t.true(visitor.hasAdditions);
});

test('with collection model that is commited but children that are changed gives change status', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();
  model.collection()[0].string = 'CHANGED';
  model.collection()[1].string = 'CHANGED';

  const visitor = new ModelAcquireStatusVisitor();
  model.traverse(visitor);

  t.false(visitor.isClean);
  t.false(visitor.hasAdditions);
  t.true(visitor.isChanged);
  t.true(visitor.isDirty);
});

test('with collection model that is commited but mixed children changed gives change status', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();
  model.collection()[0].string = 'CHANGED';

  const visitor = new ModelAcquireStatusVisitor();
  model.traverse(visitor);

  t.false(visitor.isClean);
  t.false(visitor.hasAdditions);
  t.true(visitor.isChanged);
  t.true(visitor.isDirty);
});

test('with collection model that has pending deletes gives delete status', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  model.collection.remove(subModel2);

  const visitor = new ModelAcquireStatusVisitor();
  model.traverse(visitor);

  t.false(visitor.isClean);
  t.false(visitor.hasAdditions);
  t.true(visitor.isChanged);
  t.true(visitor.hasDeletions);
  t.true(visitor.isDirty);
});

test('with collection model with additions but range limited to change child models gives only change status', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  model.collection.push(subModel1);
  subModel1.commit();

  model.collection()[0].string = 'CHANGED';

  const limiter = new DepthLimiter(2, -1);
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);

  t.false(visitor.isClean);
  t.false(visitor.hasDeletions);

  t.false(visitor.hasAdditions);
  t.true(visitor.isChanged);
  t.true(visitor.isDirty);
});

test('with collection model with additions but limited to ModelProperty types gives only changed state', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.collection()[0].string = 'CHANGED';

  const limiter = new TypeLimiter(ModelProperty);
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);

  t.false(visitor.isClean);
  t.false(visitor.hasDeletions);

  t.false(visitor.hasAdditions);
  t.true(visitor.isChanged);
  t.true(visitor.isDirty);
});

test('with collection model with additions but limited to ModelCollectionProperty types gives only added state', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.collection()[0].string = 'CHANGED';

  const limiter = new TypeLimiter(ModelCollectionProperty);
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);

  t.false(visitor.isClean);
  t.false(visitor.hasDeletions);

  t.true(visitor.isChanged);
  t.true(visitor.hasAdditions);
  t.true(visitor.isDirty);
});

test('with clean model gives no match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();

  const visitor = new ModelHasStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  expect(visitor.modelHasStatus).toBeFalsy();
});

test('with changed model gives match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();
  model.boolean = true;

  const visitor = new ModelHasStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  t.true(visitor.modelHasStatus).toBeTruthy();
});

test('with clean model gives no children', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  expect(visitor.children.length).toEqual(0);
});

test('with changed model gives match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1); // model is now changed

  model.commit();
  model.boolean = true; // the ModelProperty behind this is now changed

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  t.is(visitor.children.length, 2);
  t.is(visitor.children[0], model);
  t.is(visitor.children[1], model.getBooleanProperty());
});

test('with multiple layers of children with change status gives match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  model.collection()[0].string = 'CHANGED'; // TestableModel2 at index 0 is now changed plus the string property

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  t.is(visitor.children.length, 4);
  t.true(visitor.children.indexOf(subModel1) >= 0);
  t.true(visitor.children.indexOf(subModel1.getStringProperty()) >= 0);
  t.true(visitor.children.indexOf(model) >= 0);
  t.true(visitor.children.indexOf(model.getCollectionProperty()) >= 0);

  model.collection()[1].string = 'CHANGED'; // TestableModel2 at index 1 is now changed plus the string property

  const visitor2 = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor2);

  t.is(visitor2.children.length, 6);
  t.true(visitor2.children.indexOf(subModel1) >= 0);
  t.true(visitor2.children.indexOf(subModel1.getStringProperty()) >= 0);
  t.true(visitor2.children.indexOf(subModel2) >= 0);
  t.true(visitor2.children.indexOf(subModel2.getStringProperty()) >= 0);
  t.true(visitor.children.indexOf(model) >= 0);
  t.true(visitor.children.indexOf(model.getCollectionProperty()) >= 0);
});

test('with added children gives match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Added);
  model.traverse(visitor);

  t.is(visitor.children.length, 3);
  t.true(visitor.children.indexOf(model) >= 0);
  t.true(visitor.children.indexOf(model.getCollectionProperty()) >= 0);
  t.true(visitor.children.indexOf(subModel2) >= 0);
});

test('with added and changed children and only search added gives correct match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  const subModel3 = new TestableModel2();
  subModel3.string = 'TEST_DATA_2';
  subModel3.commit();
  model.collection.push(subModel3);

  model.collection()[0].string = 'CHANGED';
  model.collection()[1].string = 'CHANGED';

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Added);
  model.traverse(visitor);

  t.is(visitor.children.length, 3);
});

test('with added and changed children and only search changed gives correct match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2('model1');
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2('model2');
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  const subModel3 = new TestableModel2();
  subModel3.string = 'TEST_DATA_2';
  subModel3.commit();
  model.collection.push(subModel3);

  model.collection()[0].string = 'CHANGED';
  model.collection()[1].string = 'CHANGED';

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  t.is(visitor.children.length, 6);
  t.true(visitor.children.indexOf(subModel1) >= 0);
  t.true(visitor.children.indexOf(subModel2) >= 0);
  t.true(visitor.children.indexOf(subModel1.getStringProperty()) >= 0);
  t.true(visitor.children.indexOf(subModel2.getStringProperty()) >= 0);
  t.true(visitor.children.indexOf(model) >= 0);
  t.true(visitor.children.indexOf(model.getCollectionProperty()) >= 0);
});

test('nested model with leaf ModelProperty changed and limited ', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  model.collection()[0].string = 'CHANGED'; // TestableModel2 at index 0 is now changed plus the string property

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.Changed,
    new TypeLimiter(TestableModel2)
  );
  model.traverse(visitor);

  t.is(visitor.children.length, 1);
});

test('nested model with leaf ModelProperty changed and limited to ModelProperty', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  model.collection()[0].string = 'CHANGED'; // TestableModel2 at index 0 is now changed plus the string property

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.Changed,
    new TypeLimiter(ModelProperty)
  );
  model.traverse(visitor);

  t.is(visitor.children.length, 1);
  t.true(
    visitor.children.indexOf(model.collection()[0].getStringProperty()) >= 0
  );
});

test('nested model with leaf ModelProperty changed and limited to TestableModel', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  model.collection()[0].string = 'CHANGED'; // TestableModel2 at index 0 is now changed plus the string property

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.Changed,
    new TypeLimiter(TestableModel)
  );
  model.traverse(visitor);

  t.is(visitor.children.length, 1);
});

test('nested model with multiple leaf ModelProperty changed and limited to ModelProperty', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2('model1');
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();

  const subModel2 = new TestableModel2('model2');
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();

  const subModel3 = new TestableModel2('model3');
  subModel2.string = 'TEST_DATA_3';
  subModel2.commit();

  model.collection.push(subModel1);
  model.collection.push(subModel2);
  model.collection.push(subModel3);

  model.commit();

  model.collection()[0].string = 'CHANGED';
  model.collection()[1].string = 'CHANGED';
  model.collection()[2].string = 'CHANGED';

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.Changed,
    new TypeLimiter(ModelProperty)
  );
  model.traverse(visitor);

  expect(visitor.children.length).toEqual(3);
});

test('nested model with multiple leaf ModelProperty changed and limited to TestableModel', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2('model1');
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();

  const subModel2 = new TestableModel2('model2');
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();

  const subModel3 = new TestableModel2('model3');
  subModel2.string = 'TEST_DATA_3';
  subModel2.commit();

  model.collection.push(subModel1);
  model.collection.push(subModel2);
  model.collection.push(subModel3);

  model.commit();

  model.collection()[0].string = 'CHANGED';
  model.collection()[1].string = 'CHANGED';
  model.collection()[2].string = 'CHANGED';

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.Changed,
    new TypeLimiter(TestableModel)
  );
  model.traverse(visitor);

  expect(visitor.children.length).toEqual(1);
});

test('model with added submodels and visitor looking for TestableModel with Added gives no match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2('model1');
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();

  const subModel2 = new TestableModel2('model2');
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();

  const subModel3 = new TestableModel2('model3');
  subModel2.string = 'TEST_DATA_3';
  subModel2.commit();

  model.collection.push(subModel1);
  model.collection.push(subModel2);
  model.collection.push(subModel3);

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.Added,
    new TypeLimiter(TestableModel)
  );
  model.traverse(visitor);

  expect(visitor.children.length).toEqual(1);
  expect(visitor.children.indexOf(model)).toBeGreaterThanOrEqual(0);
});

test('model with added submodels and visitor looking for TestableModel with New gives match', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2('model1');
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();

  const subModel2 = new TestableModel2('model2');
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();

  const subModel3 = new TestableModel2('model3');
  subModel2.string = 'TEST_DATA_3';
  subModel2.commit();

  model.collection.push(subModel1);
  model.collection.push(subModel2);
  model.collection.push(subModel3);

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.New,
    new TypeLimiter(TestableModel)
  );
  model.traverse(visitor);

  expect(visitor.children.length).toEqual(1);
});

test('model with added submodels and searching for Added status with TestableModel2 types', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2('model1');
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();

  const subModel2 = new TestableModel2('model2');
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();

  const subModel3 = new TestableModel2('model3');
  subModel2.string = 'TEST_DATA_3';
  subModel2.commit();

  model.collection.push(subModel1);
  model.collection.push(subModel2);
  model.collection.push(subModel3);

  const visitor = new GetChildrenWithStatusVisitor(
    ModelStatus.Added,
    new TypeLimiter(TestableModel2)
  );
  model.traverse(visitor);

  expect(visitor.children.length).toEqual(3);
});

test('with no change give false', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  const visitor = new ModelIsDirtyVisitor();
  model.traverse(visitor);

  expect(visitor.isDirty).toBeFalsy('did not expected the model to be dirty');
});

test('with change give true', (t) => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const subModel2 = new TestableModel2();
  subModel2.string = 'TEST_DATA_2';
  subModel2.commit();
  model.collection.push(subModel2);

  model.commit();

  model.collection()[0].string = 'CHANGED';

  const visitor = new ModelIsDirtyVisitor();
  model.traverse(visitor);

  expect(visitor.isDirty).toBeTruthy();
});
