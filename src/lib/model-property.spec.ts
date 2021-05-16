import { Model, ModelStatus } from '../lib/api';
import { ModelProperty } from '../lib/model-property';

test('Uninitialized property is new', () => {
  const prop = new ModelProperty();
  expect(prop.status()).toBe(ModelStatus.New);
});

test('Changing the value on a new property without committing does not mark the property as changed', () => {
  const prop = new ModelProperty();
  prop.value = 0;
  expect(!!(prop.status() & ModelStatus.New)).toBeTruthy();
  expect(!!(prop.status() & ModelStatus.Changed)).toBeTruthy();
});

test('Initializing model property change subject initializes but does not change the subject if no value is changed', () => {
  let modelPropertyChanged = false;
  const prop = new ModelProperty<string>();
  prop.changed.subscribe((model) => {
    if (model) {
      modelPropertyChanged = true;
    }
  });

  expect(modelPropertyChanged).toBeFalsy();
});

test('Initializing model property change subject initializes and calls the subject when the value changes', () => {
  let changedModel: Model<number> | undefined;
  let modelPropertyChanged = false;
  const prop = new ModelProperty<number>();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
      modelPropertyChanged = true;
    }
  });

  prop.value = 0;

  expect(modelPropertyChanged);
  expect(prop.value).toBe(changedModel?.value);
});

test('Set value on multiple types of model property objects work the same between each', () => {
  const numberProp = new ModelProperty<number>();
  numberProp.value = 0;
  expect(!!(numberProp.status() & ModelStatus.New)).toBeTruthy();
  expect(!!(numberProp.status() & ModelStatus.Changed)).toBeTruthy();

  const stringProp = new ModelProperty<string>();
  stringProp.value = 'test';
  expect(!!(stringProp.status() & ModelStatus.New)).toBeTruthy();
  expect(!!(stringProp.status() & ModelStatus.Changed)).toBeTruthy();

  const booleanProp = new ModelProperty<boolean>();
  booleanProp.value = false;
  expect(!!(booleanProp.status() & ModelStatus.New)).toBeTruthy();
  expect(!!(booleanProp.status() & ModelStatus.Changed)).toBeTruthy();
});

test('Commits through set workflow changes the status as expected', () => {
  const prop = new ModelProperty();
  expect(prop.status()).toBe(ModelStatus.New);

  prop.commit();
  expect(prop.status()).toBe(ModelStatus.None);

  prop.value = 1;
  expect(prop.status()).toBe(ModelStatus.Changed);

  prop.commit();
  expect(prop.status()).toBe(ModelStatus.None);
});

test('Setting the value of a committed and unchanged property has no effect', () => {
  const prop = new ModelProperty();
  prop.commit();
  expect(prop.status()).toBe(ModelStatus.None);

  prop.value = undefined;
  expect(prop.status()).toBe(ModelStatus.None);
});

test('Setting the value to a different than internal value on a committed property makes the property changed', () => {
  const prop = new ModelProperty();
  prop.commit();
  prop.value = 1;
  expect(prop.status()).toBe(ModelStatus.Changed);
  prop.commit();
  expect(prop.status()).toBe(ModelStatus.None);
  prop.value = 2;
  expect(prop.status()).toBe(ModelStatus.Changed);
});

test('Setting the value to the same internal value has no effect', () => {
  const prop = new ModelProperty();
  prop.commit();
  prop.value = 1;
  expect(prop.status()).toBe(ModelStatus.Changed);
  prop.commit();
  expect(prop.status()).toBe(ModelStatus.None);
  prop.value = 1;
  expect(prop.status()).toBe(ModelStatus.None);
});

test('is not trigger by constructor', () => {
  let changedModel: any;
  const prop = new ModelProperty<any>();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
    }
  });
  expect(changedModel).toBe(undefined);
});

test('is trigger by value setter', () => {
  let changedModel: any;
  const prop = new ModelProperty<any>();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
    }
  });
  prop.value = 0;
  expect(changedModel).toBe(prop);
});

test('is trigger by rollback', () => {
  let changedModel: Model<any> | undefined;
  const prop = new ModelProperty();
  prop.changed.subscribe((model) => {
    if (model) {
      changedModel = model;
    }
  });
  prop.value = 0;
  prop.rollback();

  expect(changedModel?.value).toBe(undefined);
});
