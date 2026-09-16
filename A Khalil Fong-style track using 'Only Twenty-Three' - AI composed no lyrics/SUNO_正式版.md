# 《草稿箱》正式人声版 · Suno 投喂包

目标时长：**3.5–4.5 分钟**（Suno 单次约 2–4 分钟，长曲用 Extend 接）

---

## 一、Suno 操作步骤（Custom）

1. 打开 [suno.com](https://suno.com) → **Create** → 打开 **Custom**
2. **Lyrics**：粘贴下方「完整歌词」全部内容（含 `[Tag]`）
3. **Style of Music**：粘贴下方 Style 一句
4. **Exclude Styles**（若有该栏）：粘贴 Negative
5. **Title**：草稿箱
6. 生成 2–4 版，挑声线最「方大同」的一版
7. 若不足 3 分钟：对选中的版本点 **Extend**，歌词续写「副歌 2 + Outro」段再生成

**模型建议**：v4.5 / v4（人声更稳）；中文咬字优先选最新可用模型。

---

## 二、Style（直接粘贴）

```
Chinese Mandopop neo-soul ballad, 72 BPM, Ab major, Khalil Fong 方大同 inspired male vocal, warm breathy intimate voice, Rhodes electric piano, fingerstyle nylon acoustic guitar, soft brush drums, round electric bass, jazzy maj7 m9 sus4 chords, late night bedroom soul, emotional but restrained, high quality Mandarin R&B ballad, gentle swing, natural room reverb, 3 to 4 minutes
```

## 三、Exclude / Negative

```
No EDM, no trap, no autotune overdrive, no yelling, no orchestral epic, no corporate pop, no fast tempo, no country twang, no metal
```

## 四、完整歌词（粘贴 Lyrics 框）

```
[Intro]
Rhodes 电钢，木吉他指弹，安静进入

[Verse]
收件箱很安静
草稿却存了七年
第一封写着「我没事」
落款是删了又打的昨天

[Verse]
光标闪得很慢
像谁在门外犹豫
我把「喜欢」折成附件
又改成「最近好吗」

[Pre-Chorus]
原来长大不是学会发送
是懂得有些字
只适合留在半路

[Chorus]
别急着清空草稿箱
那里住着没长大的晚上
一笔一画都是方向
写歪了也算一趟
别急着清空草稿箱
有些人只在未完成里
还愿意陪我
站到天亮

[Verse]
后来换了地址
密码却还在用旧的
好像只要不点删除
故事就没真的结束

[Verse]
楼下的便利店
还在播我们那年的歌
我买了两瓶汽水
又默默放回货架

[Pre-Chorus]
原来成熟不是学会关机
是有些夜
允许自己开着机

[Chorus]
别急着清空草稿箱
那里住着没长大的晚上
一笔一画都是方向
写歪了也算一趟
别急着清空草稿箱
有些人只在未完成里
还愿意陪我
站到天亮

[Instrumental Break]
电钢与吉他对话，鼓轻，留白

[Bridge]
如果人生有存档
我想存那个雨天
你把伞倾向我这边
自己的肩膀湿了一片
如果原谅有附件
请替我签上
那个还没学会告别的少年

[Chorus]
就让草稿箱一直满着
像心口一小块没关灯的夜
等哪天勇气路过
随便点开哪一篇
都能读见
我们曾经那么近地
犹豫过

[Chorus]
别急着清空草稿箱
未完成也是种勇敢
天亮以前先把灯留着
有人会读完
别急着清空草稿箱
写到最后一行才发现
每一页涂改
都是我来过的痕迹

[Outro]
（渐弱）
草稿箱……还亮着
就当我还在这里
犹豫过

```

---

## 五、若时长还不够：点 Extend 续写

把选中版本 Extend，附加歌词：

```
[Outro]
草稿箱还亮着
像一句没说完的「后来」
如果哪天你路过
别清空
就让它
一直
亮着

[Outro]
一直亮着
```

---

## 六、中文制作备注（可选，有些版本支持粘贴）

```
中文 Neo-Soul 抒情，方大同气质。72BPM，Ab大调。
男声：主歌贴麦气声，副歌略开，句尾保留呼吸与字头咬字。
编曲：木吉他指弹 + Rhodes + 轻鼓刷 + 圆润贝斯。
情绪：深夜独处、克制遗憾；不要苦情嘶吼。
副歌可叠一层低声部「啊」。
```

---

## 七、生成后调参（不满意时）

| 问题 | 改法 |
|------|------|
| 太快 | Style 里加 `very slow, 68 BPM, ballad tempo` |
| 太洋、中文糊 | 加 `clear Mandarin lyrics, natural Chinese diction` |
| 太满、没方大同感 | 加 `sparse arrangement, breathy, no backing choir` |
| 时长偏短 | Extend，或删中间 Verse 换更长副歌重复 |
| 副歌不响 | 在 Chorus 前加 `[Build]`，副歌后加 `[Drop energy slightly]` |

---

## 八、本地文件

- `草稿箱_demo.wav` — 器乐 Demo（对旋律/和声用）
- `草稿箱_score.abc` — ABC 谱
- `README.md` — 词曲说明
