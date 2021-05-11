import test from 'ava';

import { Model, ModelStatus } from './api';
import { ModelProperty } from './model-property';

test('Uninitialized property is new', (t) => {
  const prop = new ModelProperty();
  t.is(prop.status(), ModelStatus.New);
});

test('Changing the value on a new property without commiting does not mark the property as changed', (t) => {
  const prop = new ModelProperty();
  prop.value = 0;
  t.true(!!(prop.status() & ModelStatus.New));
  t.true(!!(prop.status() & ModelStatus.Changed));
});

test('Initializing model property change subject initializes but does not change the subject if no value is changed', (t) => {
  let modelPropertyChanged = false;
  const prop = new ModelProperty<string>();
  prop.changed.subscribe((model) => {
    if (model) {
      modelPropertyChanged = true;
    }
  });

  t.false(modelPropertyChanged);
});

test('Initializing model property change subject initializes and calls the subject when the value changes', (t) => {
  let changedModel: Model<number>;
  let modelPropertyChanged = false;
  const prop = new ModelProperty<number>();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
      modelPropertyChanged = true;
    }
  });

  prop.value = 0;

  t.true(modelPropertyChanged);
  t.is(prop.value, changedModel.value);
});

test('Set value on multiple types of model property objects work the same between each', (t) => {
  const numberProp = new ModelProperty<number>();
  numberProp.value = 0;
  t.true(!!(numberProp.status() & ModelStatus.New));
  t.true(!!(numberProp.status() & ModelStatus.Changed));

  const stringProp = new ModelProperty<string>();
  stringProp.value = 'test';
  t.true(!!(stringProp.status() & ModelStatus.New));
  t.true(!!(stringProp.status() & ModelStatus.Changed));

  const booleanProp = new ModelProperty<boolean>();
  booleanProp.value = false;
  t.true(!!(booleanProp.status() & ModelStatus.New));
  t.true(!!(booleanProp.status() & ModelStatus.Changed));
});

test('Commits through set workflow changes the status as expected', (t) => {
  const prop = new ModelProperty();
  t.is(prop.status(), ModelStatus.New);

  prop.commit();
  t.is(prop.status(), ModelStatus.None);

  prop.value = 1;
  t.is(prop.status(), ModelStatus.Changed);

  prop.commit();
  t.is(prop.status(), ModelStatus.None);
});

test('Setting the value of a commited and unchanged property has no effect', (t) => {
  const prop = new ModelProperty();
  prop.commit();
  t.is(prop.status(), ModelStatus.None);

  prop.value = undefined;
  t.is(prop.status(), ModelStatus.None);
});

test('Setting the value to a different than internal value on a commited property makes the property changed', (t) => {
  const prop = new ModelProperty();
  prop.commit();
  prop.value = 1;
  t.is(prop.status(), ModelStatus.Changed);
  prop.commit();
  t.is(prop.status(), ModelStatus.None);
  prop.value = 2;
  t.is(prop.status(), ModelStatus.Changed);
});

test('Setting the value to the same internal value has no effect', (t) => {
  const prop = new ModelProperty();
  prop.commit();
  prop.value = 1;
  t.is(prop.status(), ModelStatus.Changed);
  prop.commit();
  t.is(prop.status(), ModelStatus.None);
  prop.value = 1;
  t.is(prop.status(), ModelStatus.None);
});

test('is not trigger by constructor', (t) => {
  let changedModel: any;
  const prop = new ModelProperty<any>();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
    }
  });
  t.is(changedModel, undefined);
});

test('is trigger by value setter', (t) => {
  let changedModel: any;
  const prop = new ModelProperty<any>();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
    }
  });
  prop.value = 0;
  t.is(changedModel, prop);
});

test('is trigger by rollback', (t) => {
  let changedModel: Model<any>;
  const prop = new ModelProperty();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
    }
  });
  prop.value = 0;
  prop.rollback();
  t.is(changedModel.value, undefined);
});
