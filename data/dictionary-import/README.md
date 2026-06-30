# 云端词典导入通道

把词汇表和 MP3 放到 `source/`，再运行脚本生成云端索引。

## 目录

```text
data/dictionary-import/source/
  junior/
    words.csv
    audio/
      digital.mp3
  senior/
    words.csv
    audio/
      platform.mp3
  ielts/
    words.csv
    audio/
      participant.mp3
```

## CSV 格式

```csv
word,phonetic,definition,example
digital,did3itl,adj. 数字的,Digital tools are useful.
```

字段：

- `word` 必填
- `phonetic` 可空
- `definition` 可空
- `example` 可空

MP3 文件名推荐用小写单词：

```text
digital.mp3
social-media.mp3
```

## 生成索引

```bash
python3 scripts/build_dictionary_import.py
```

输出：

```text
data/dictionary-import/output/word-dictionary.json
data/dictionary-import/output/upload-audio-manifest.json
```

## 云端目标

音频上传到：

```text
_dictionary_audio/{level}/{filename}.mp3
```

词典索引写入云数据库：

```text
wordDictionary
```
