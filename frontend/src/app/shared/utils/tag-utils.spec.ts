import { parseTopicTags } from './tag-utils';

describe('tag-utils: parseTopicTags', () => {
  it('should return empty array for null, undefined, or empty string', () => {
    expect(parseTopicTags(null)).toEqual([]);
    expect(parseTopicTags(undefined)).toEqual([]);
    expect(parseTopicTags('')).toEqual([]);
    expect(parseTopicTags('   ')).toEqual([]);
  });

  it('should format single tag with hashtag prefix', () => {
    expect(parseTopicTags('engineering')).toEqual(['#engineering']);
    expect(parseTopicTags('#engineering')).toEqual(['#engineering']);
  });

  it('should parse comma-separated tags and ensure # prefix for all', () => {
    expect(parseTopicTags('engineering, consensus')).toEqual(['#engineering', '#consensus']);
    expect(parseTopicTags('#engineering, #consensus')).toEqual(['#engineering', '#consensus']);
    expect(parseTopicTags('devops, #cloud, kubernetes')).toEqual(['#devops', '#cloud', '#kubernetes']);
  });

  it('should ignore empty tokens within commas', () => {
    expect(parseTopicTags('tag1, , tag2, ')).toEqual(['#tag1', '#tag2']);
  });
});
