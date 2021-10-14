import { describe, it } from 'mocha';
import { expect } from 'chai'

describe('Sanity', () => {
  it('should pass', () => {
    expect({  foo: 'bar' }).to.deep.equal({  foo: 'bar' });
  });
});