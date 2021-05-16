import { ObservableArray } from 'knockout';
import { ModelStatus } from '../lib/api';
import { ModelCollectionProperty } from '../lib/model-collection';
import { ModelProperty } from '../lib/model-property';
import { NamedPropertyModel } from '../lib/named-property-model';
import { DepthLimiter, TypeLimiter } from '../lib/visitor-limiters';
import {
  GetChildrenWithStatusVisitor,
  ModelAcquireStatusVisitor,
  ModelHasStatusVisitor,
  ModelIsDirtyVisitor,
} from '../lib/visitors';

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

  get collection(): ObservableArray<TestableModel2> {
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

test('with committed model gives clean status', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();

  const visitor = new ModelAcquireStatusVisitor();
  model.traverse(visitor);

  expect(visitor.isClean).toBeTruthy();
  expect(visitor.isDirty).toBeFalsy();
});

test('with model with collection that has pending addition gives add status', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  const visitor = new ModelAcquireStatusVisitor();
  model.traverse(visitor);

  expect(visitor.isClean).toBeFalsy();
  expect(visitor.isDirty).toBeTruthy();
  expect(visitor.hasAdditions).toBeTruthy();
});

test('with collection model that is committed but children that are changed gives change status', () => {
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

  expect(visitor.isClean).toBeFalsy();
  expect(visitor.hasAdditions).toBeFalsy();
  expect(visitor.isChanged).toBeTruthy();
  expect(visitor.isDirty).toBeTruthy();
});

test('with collection model that is committed but mixed children changed gives change status', () => {
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

  expect(visitor.isClean).toBeFalsy();
  expect(visitor.hasAdditions).toBeFalsy();
  expect(visitor.isChanged).toBeTruthy();
  expect(visitor.isDirty).toBeTruthy();
});

test('with collection model that has pending deletes gives delete status', () => {
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

  expect(visitor.isClean).toBeFalsy();
  expect(visitor.hasAdditions).toBeFalsy();
  expect(visitor.isChanged).toBeTruthy();
  expect(visitor.hasDeletions).toBeTruthy();
  expect(visitor.isDirty).toBeTruthy();
});

test('with collection model with additions but range limited to change child models gives only change status', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  model.collection.push(subModel1);
  subModel1.commit();

  model.collection()[0].string = 'CHANGED';

  const limiter = new DepthLimiter(2, -1);
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);

  expect(visitor.isClean).toBeFalsy();
  expect(visitor.hasDeletions).toBeFalsy();

  expect(visitor.hasAdditions).toBeFalsy();
  expect(visitor.isChanged).toBeTruthy();
  expect(visitor.isDirty).toBeTruthy();
});

test('with collection model with additions but limited to ModelProperty types gives only changed state', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.collection()[0].string = 'CHANGED';

  const limiter = new TypeLimiter(ModelProperty);
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);

  expect(visitor.isClean).toBeFalsy();
  expect(visitor.hasDeletions).toBeFalsy();

  expect(visitor.hasAdditions).toBeFalsy();
  expect(visitor.isChanged).toBeTruthy();
  expect(visitor.isDirty).toBeTruthy();
});

test('with collection model with additions but limited to ModelCollectionProperty types gives only added state', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.collection()[0].string = 'CHANGED';

  const limiter = new TypeLimiter(ModelCollectionProperty);
  const visitor = new ModelAcquireStatusVisitor(limiter);
  model.traverse(visitor);

  expect(visitor.isClean).toBeFalsy();
  expect(visitor.hasDeletions).toBeFalsy();

  expect(visitor.isChanged).toBeTruthy();
  expect(visitor.hasAdditions).toBeTruthy();
  expect(visitor.isDirty).toBeTruthy();
});

test('with clean model gives no match', () => {
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

test('with changed model gives match', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();
  model.boolean = true;

  const visitor = new ModelHasStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  expect(visitor.modelHasStatus).toBeTruthy();
});

test('with clean model gives no children', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1);

  model.commit();

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  expect(visitor.children.length).toBe(0);
});

test('with changed model gives match', () => {
  const model = new TestableModel();

  const subModel1 = new TestableModel2();
  subModel1.string = 'TEST_DATA_1';
  subModel1.commit();
  model.collection.push(subModel1); // model is now changed

  model.commit();
  model.boolean = true; // the ModelProperty behind this is now changed

  const visitor = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor);

  expect(visitor.children.length).toBe(2);
  expect(visitor.children[0]).toBe(model);
  expect(visitor.children[1]).toBe(model.getBooleanProperty());
});

test('with multiple layers of children with change status gives match', () => {
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

  expect(visitor.children.length).toBe(4);
  expect(visitor.children.indexOf(subModel1) >= 0).toBeTruthy();
  expect(
    visitor.children.indexOf(subModel1.getStringProperty()) >= 0
  ).toBeTruthy();
  expect(visitor.children.indexOf(model) >= 0).toBeTruthy();
  expect(
    visitor.children.indexOf(model.getCollectionProperty()) >= 0
  ).toBeTruthy();

  model.collection()[1].string = 'CHANGED'; // TestableModel2 at index 1 is now changed plus the string property

  const visitor2 = new GetChildrenWithStatusVisitor(ModelStatus.Changed);
  model.traverse(visitor2);

  expect(visitor2.children.length).toBe(6);
  expect(visitor2.children.indexOf(subModel1) >= 0).toBeTruthy();
  expect(
    visitor2.children.indexOf(subModel1.getStringProperty()) >= 0
  ).toBeTruthy();
  expect(visitor2.children.indexOf(subModel2) >= 0).toBeTruthy();
  expect(
    visitor2.children.indexOf(subModel2.getStringProperty()) >= 0
  ).toBeTruthy();
  expect(visitor.children.indexOf(model) >= 0).toBeTruthy();
  expect(
    visitor.children.indexOf(model.getCollectionProperty()) >= 0
  ).toBeTruthy();
});

test('with added children gives match', () => {
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

  expect(visitor.children.length).toBe(3);
  expect(visitor.children.indexOf(model) >= 0).toBeTruthy();
  expect(
    visitor.children.indexOf(model.getCollectionProperty()) >= 0
  ).toBeTruthy();
  expect(visitor.children.indexOf(subModel2) >= 0).toBeTruthy();
});

test('with added and changed children and only search added gives correct match', () => {
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

  expect(visitor.children.length).toBe(3);
});

test('with added and changed children and only search changed gives correct match', () => {
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

  expect(visitor.children.length).toBe(6);
  expect(visitor.children.indexOf(subModel1) >= 0).toBeTruthy();
  expect(visitor.children.indexOf(subModel2) >= 0).toBeTruthy();
  expect(
    visitor.children.indexOf(subModel1.getStringProperty()) >= 0
  ).toBeTruthy();
  expect(
    visitor.children.indexOf(subModel2.getStringProperty()) >= 0
  ).toBeTruthy();
  expect(visitor.children.indexOf(model) >= 0).toBeTruthy();
  expect(
    visitor.children.indexOf(model.getCollectionProperty()) >= 0
  ).toBeTruthy();
});

test('nested model with leaf ModelProperty changed and limited ', () => {
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

  expect(visitor.children.length).toBe(1);
});

test('nested model with leaf ModelProperty changed and limited to ModelProperty', () => {
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

  expect(visitor.children.length).toBe(1);
  expect(
    visitor.children.indexOf(model.collection()[0].getStringProperty()) >= 0
  ).toBeTruthy();
});

test('nested model with leaf ModelProperty changed and limited to TestableModel', () => {
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

  expect(visitor.children.length).toBe(1);
});

test('nested model with multiple leaf ModelProperty changed and limited to ModelProperty', () => {
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

  expect(visitor.children.length).toBe(3);
});

test('nested model with multiple leaf ModelProperty changed and limited to TestableModel', () => {
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

  expect(visitor.children.length).toBe(1);
});

test('model with added sub-models and visitor looking for TestableModel with Added gives no match', () => {
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

  expect(visitor.children.length).toBe(1);
  expect(visitor.children.indexOf(model) >= 0).toBeTruthy();
});

test('model with added sub-models and visitor looking for TestableModel with New gives match', () => {
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

  expect(visitor.children.length).toBe(1);
});

test('model with added sub-models and searching for Added status with TestableModel2 types', () => {
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

  expect(visitor.children.length).toBe(3);
});

test('with no change give false', () => {
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

  expect(visitor.isDirty).toBeFalsy();
});

test('with change give true', () => {
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
