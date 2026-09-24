# Reading — explanation_truncated (deterministic scan)

- **Fecha:** 2026-09-24
- **Método:** por cada pregunta Reading se comparó `Question.explanation` (normalizado) contra el "Rationale" del PDF `ANS …` (join por `Question ID` hex; metadata de cola removida, líneas des-hifenadas). Se marca **explanation_truncated** cuando la explicación publicada es un **prefijo textual exacto** del rationale fuente Y (a) termina cortada a mitad de oración —sin puntuación terminal— con cola faltante ≥8 chars alfanuméricos, o (b) le faltan ≥40 chars alfanuméricos.
- **Validación:** WiC=10; incluye p.ej. WiC HARD seq5 (`...undermine t` → `...undermine their own marketing in pursuit of that goal.`).
- **Total: 77** · sev=Media (no cambia la clave; degrada la explicación mostrada). Recuperable: cola completa en el `ANS`. **Fix generado** en `scratchpad/specs-reading-explanations.json` (specs `text{field:explanation}`, valor = rationale completo).

## Por topic

| Topic | # |
|---|---|
| Command of Evidence | 27 |
| Inferences | 15 |
| Cross-Text Connections | 12 |
| Words in Context | 10 |
| Text Structure and Purpose | 8 |
| Central Ideas and Details | 5 |

## Detalle (77)

| qid | topic | dif | seq | extId | pub_len | ans_len | mid-sent | tail (~80 chars faltantes) |
|---|---|---|---|---|---|---|---|---|
| cmsjro2y303s0qmt1v7ph4mlr | Central Ideas and Details | EASY | 7 | 2edd7ffe | 2016 | 2086 | sí | …’s thinking about how long the site had been used for playing mancala. |
| cmsjro3z704hnqmt1hrue7ck1 | Central Ideas and Details | HARD | 10 | e80ba20d | 1294 | 2913 | sí | …rect because the text doesn’t focus on people’s lack of a principled way to iden |
| cmsjro3zd04hxqmt1qhshe3a2 | Central Ideas and Details | HARD | 12 | 34c2e387 | 1601 | 1889 | sí | … capitalism in Africa, positive or negative. Rather, the text explains why preco |
| cmsjro3zi04i2qmt1ya6td4af | Central Ideas and Details | HARD | 13 | 7812801f | 1514 | 2278 | sí | … compete with the nutrient-absorbing fynbos roots, they grow much better. Choice |
| cmsjro3xm04f7qmt10mwl1w2k | Central Ideas and Details | MEDIUM | 7 | b38935ab | 1602 | 2433 | sí | …ile Mieszko II Lambert ruled from 1025 to 1031 CE. The 10th century spans the ye |
| cmsjro19x02xjqmt1vj8tnuk2 | Command of Evidence | EASY | 4 | a9040290 | 332 | 963 | no | … Choice B is incorrect. This choice doesn’t complete the example. The graph show |
| cmsjro1ap02ynqmt1m2v68i5x | Command of Evidence | EASY | 12 | a9ac31e4 | 211 | 565 | no | … Choice B is incorrect. This choice misreads the graph. The graph shows that Gor |
| cmsjro1b302z7qmt1nd9d0vfo | Command of Evidence | EASY | 16 | e441da80 | 156 | 1036 | no | … Choice B is incorrect. This choice misreads the graph. The 1,600 articles publi |
| cmsjro1bf02zmqmt1jsunxtxy | Command of Evidence | EASY | 19 | e1ee5f5c | 1791 | 2065 | sí | …ed them into the empty schoolroom"), it doesn’t show Patty asserting herself by  |
| cmsjro1c0030bqmt1vdkehstr | Command of Evidence | EASY | 24 | 89f71526 | 243 | 489 | no | … Choice A is incorrect. Alcedo has a lower rate of deformation than Sierra Negra |
| cmsjro1c5030gqmt1lb73sac3 | Command of Evidence | EASY | 25 | 73c091d2 | 2101 | 2267 | sí | …hat olive trees thrive in hot, dry environments doesn’t directly address why the |
| cmsjro1gj031zqmt1w8h34uqx | Command of Evidence | EASY | 36 | c384987b | 2025 | 2210 | sí | …d produce similar sounds for different purposes, so scientists could not conclud |
| cmsjro1h7032kqmt1by2h0n18 | Command of Evidence | HARD | 2 | 0d7f4966 | 1318 | 1480 | sí | …cribed in the text, nothing in the text or this choice suggests that the fossils |
| cmsjro1hd032pqmt1tlwf8gt4 | Command of Evidence | HARD | 3 | 068f939b | 1136 | 2633 | sí | …ed in drama and the root mim- coming to be associated with ’ music and poetry wo |
| cmsjro1je034mqmt16gcsrow7 | Command of Evidence | HARD | 17 | df91532e | 1507 | 2366 | sí | …oice B is incorrect because finding that new students experience increased perfo |
| cmsjro1ji034rqmt1wavmzpf4 | Command of Evidence | HARD | 18 | 44da37eb | 1460 | 2664 | sí | …on that a particular form of venom production spread in C. granosus in part beca |
| cmsjro1jm034wqmt1pnbn1egk | Command of Evidence | HARD | 19 | 626a1308 | 1679 | 2544 | sí | …ct because the table indicates that T-ReCS at the Gemini Observatory collected i |
| cmsjro1k0035eqmt1gnmsro1n | Command of Evidence | HARD | 23 | 4a07be59 | 1241 | 2633 | sí | …eir respective familiar languages rather than dogs’ ability to distinguish speec |
| cmsjro1kk035yqmt1odg5ll2d | Command of Evidence | HARD | 27 | 31ad8024 | 1000 | 2299 | sí | …research team s hypothesis. While this finding shows that wide-headed bristlemou |
| cmsjro1kv0368qmt1oxt4ta8k | Command of Evidence | HARD | 29 | cca6fae9 | 956 | 2783 | sí | …ct to greater amounts of wastewater and exhibit higher delta 15-N values in seag |
| cmsjro1l0036dqmt1gvibkji9 | Command of Evidence | HARD | 30 | 378c66d5 | 1286 | 1352 | sí | …cratic whole instead of through one or two narrow cultural lenses. |
| cmsjro1l6036iqmt1r6wkdnmn | Command of Evidence | HARD | 31 | 35ec767c | 832 | 908 | sí | … looking for an example that shows how some words for corn can be unrelated. |
| cmsjro1o9036xqmt1mfoox9im | Command of Evidence | HARD | 34 | 09775cbf | 834 | 3778 | sí | …articipants in the experiment with Tiffany & Co. and Forever 21 judged the same  |
| cmsjro1od0372qmt1jd2t3w7w | Command of Evidence | HARD | 35 | 8391a002 | 1390 | 1810 | sí | … digest and more nutritious. Choice D is incorrect because Granito and Álvarez’s |
| cmsjro1oh0377qmt1wjcrj5ip | Command of Evidence | HARD | 36 | 124fdcd7 | 1562 | 2398 | sí | …support the researchers claim that archaeologists are unlikely to be replaced by |
| cmsjro29403h1qmt1vlngnyad | Command of Evidence | MEDIUM | 3 | 356ad646 | 1001 | 2416 | sí | … Choice A is incorrect because a finding of similar waterbird community integrit |
| cmsjro29j03hgqmt1pedgajtu | Command of Evidence | MEDIUM | 6 | 7edfb2c5 | 179 | 719 | no | … Choice A is incorrect. This choice misreads the graph. Neither artifact K3_9 no |
| cmsjro2a203i0qmt1is3kvl3r | Command of Evidence | MEDIUM | 10 | f8244f7c | 686 | 3547 | sí | …ll surface area and habitat temperature in the thrashers they studied. The data  |
| cmsjro2c603k8qmt1mlddbnnt | Command of Evidence | MEDIUM | 26 | dd349efc | 1236 | 2085 | sí | …he occupation ’ being considered. Choice B is incorrect because it identifies a  |
| cmsjro2cb03kdqmt1q2ameh4p | Command of Evidence | MEDIUM | 27 | 1db1a9a6 | 931 | 1761 | no | …d. Choice A is incorrect because the bar graph shows that in 2019 the nitrogen g |
| cmsjro2ck03knqmt1zmxenabk | Command of Evidence | MEDIUM | 29 | 98fd50f2 | 1706 | 2044 | sí | …t virtual tours might make in-person visits seem unnecessary. This finding indic |
| cmsjro2cy03l2qmt1gh2cr6aq | Command of Evidence | MEDIUM | 32 | 87023f34 | 1993 | 2111 | sí | …oing cycle of anticipation followed by regret. Instead, the speaker is simply la |
| cmsjro21c03dgqmt1vrj23g46 | Cross-Text Connections | EASY | 15 | 88bb0f6f | 1068 | 1137 | sí | … at all. Instead, it focuses on a third factor: global food supplies. |
| cmsjro21j03dqqmt1j5gbbrj3 | Cross-Text Connections | HARD | 2 | 105ea6de | 1097 | 1259 | sí | …oice C is incorrect. The author of Text 2 agrees that the potential toxicity of  |
| cmsjro21p03e0qmt1r5w09poz | Cross-Text Connections | HARD | 4 | a87c3925 | 1066 | 1154 | sí | …is responsible for its flavor in any way. And Text 2 never mentions fermentation |
| cmsjro21w03eaqmt1hykdprlg | Cross-Text Connections | HARD | 6 | f7c02e89 | 1313 | 2107 | sí | …earchers, regularly use the method of listing credits. Choice B is incorrect. It |
| cmsjro21z03efqmt1oe4c9y1t | Cross-Text Connections | HARD | 7 | 96f3accc | 1290 | 3521 | sí | …ext 2 doesn t suggest that film historians regard the view about film s transfor |
| cmsjro22603epqmt1ibgunfkt | Cross-Text Connections | HARD | 9 | 6a1dc7c5 | 1232 | 1459 | sí | …ngages the same themes as other novels by Woolf that are considered classics. Ch |
| cmsjro22903euqmt10qwkgmzy | Cross-Text Connections | HARD | 10 | 17bf10de | 886 | 1167 | sí | …rrect. This doesn’t accurately describe the difference. Text 1 actually says tha |
| cmsjro22c03ezqmt1o87yfmft | Cross-Text Connections | HARD | 11 | d0198544 | 1158 | 2449 | no | …vidence is. Choice A is incorrect because both texts indicate that chickens were |
| cmsjro22y03f4qmt1zhzpzslo | Cross-Text Connections | HARD | 12 | de2c2f57 | 1147 | 1258 | sí | … attempt to reconcile the standard view and new research is flawed, and still fa |
| cmsjro12t02urqmt12i8b5hhl | Cross-Text Connections | MEDIUM | 1 | 8de51658 | 1202 | 1305 | sí | …ther text makes this distinction between laboratory findings and the way the uni |
| cmsjro2py03mgqmt15szncef4 | Cross-Text Connections | MEDIUM | 6 | 03080769 | 1172 | 1307 | sí | … the idea that some facts are true based on instinct — ’ it doesn t mention the  |
| cmsjro2qb03mvqmt147aoyltf | Cross-Text Connections | MEDIUM | 9 | f52cc78c | 1285 | 1326 | sí | …ther hunting strategies and food sources. |
| cmsjro2zv03udqmt1jpgcw3e7 | Inferences | EASY | 8 | 4025e00c | 1865 | 2437 | sí | …doesn t compare land-use requirements of these crops. Choice D is incorrect beca |
| cmsjro30i03v7qmt1glvjrb30 | Inferences | HARD | 1 | f1bfbed3 | 1311 | 3497 | sí | …hat Coll and colleagues may have treated some of the differences among microorga |
| cmsjro30l03vcqmt1t5yy8cei | Inferences | HARD | 2 | 6b8a7c74 | 1276 | 2447 | sí | …nce of digital versus physical gift cards and the relative ease with which ’ the |
| cmsjro30s03vmqmt1cttk4ntm | Inferences | HARD | 4 | 4b3d6062 | 1609 | 1974 | sí | … competition between species. Choice C is incorrect because the text ’ doesn t s |
| cmsjro30w03vrqmt1bf2kfuze | Inferences | HARD | 5 | 58e9e497 | 1807 | 2106 | sí | … using Haudenosaunee farming techniques early in the nineteenth century. This su |
| cmsjro31003vwqmt119mzxbqc | Inferences | HARD | 6 | e185a21f | 1977 | 2027 | sí | …n for such an ancestor to move bipedally in trees. |
| cmsjro31703w6qmt1cnj00k9h | Inferences | HARD | 8 | 4ba0695d | 1489 | 2536 | sí | …n each species. Therefore, it isn’t logical to infer that modern llama populatio |
| cmsjro37003xzqmt1wivusj8w | Inferences | HARD | 21 | 5c7e0d62 | 1559 | 1884 | sí | …Arthurian legends in Geoffrey of Monmouth s History differ from those in Wace s  |
| cmsjro37803y9qmt18ecvopnm | Inferences | HARD | 23 | e503ae04 | 1663 | 2134 | sí | …t it would be beneficial to reduce delivery times. Choice D is ’ incorrect becau |
| cmsjro37c03yeqmt1zeec3vnb | Inferences | HARD | 24 | cae97f58 | 1645 | 1793 | sí | …ns growing beneath crystals of different degrees of thickness or consider how th |
| cmsjro37h03yjqmt1t65blora | Inferences | HARD | 25 | 65502c46 | 1557 | 2657 | sí | …ice of gifting those items within the craft guilds was intended to limit ’ knowl |
| cmsjro2t203psqmt11xmdakn9 | Inferences | MEDIUM | 4 | 6409016a | 1971 | 2043 | sí | …t need a large budget; the studies have no direct bearing on each other. |
| cmsjro2tf03q7qmt1e5rnb1bq | Inferences | MEDIUM | 7 | 7ae8065c | 1379 | 2241 | sí | …rd as it pertains to Sakha and Kaluli songs and doesn’t suggest that there is le |
| cmsjro2tt03qmqmt1epocj5tq | Inferences | MEDIUM | 10 | d8b78a2b | 1826 | 2458 | sí | …gins can’t be determined with the available evidence. The text leaves open the p |
| cmsjro2xf03r1qmt17r70nnck | Inferences | MEDIUM | 13 | 7afdcca2 | 1600 | 1874 | sí | …there. While the text mentions that over ’ 600 languages are spoken in New York  |
| cmsjro40z04jbqmt18arrygng | Text Structure and Purpose | EASY | 5 | 809addda | 1974 | 2237 | sí | …e hills of alien lands," establishing that the current setting is a foreign plac |
| cmsjro38603z8qmt11brkhrmr | Text Structure and Purpose | HARD | 4 | c61a7c4a | 1502 | 2848 | sí | …scusses O Brien and Ahmed s study as an example of why caution is needed when di |
| cmsjro38i03znqmt1z1j984ia | Text Structure and Purpose | HARD | 7 | 65406d2c | 1639 | 2082 | sí | … species within this family. Choice D is incorrect. Although the silversword all |
| cmsjro38m03zsqmt17pvd2ix5 | Text Structure and Purpose | HARD | 8 | 4ed09415 | 1363 | 3231 | no | …t pattern. Choice A is incorrect. Although the text discusses two different resp |
| cmsjro396040hqmt10psiyotr | Text Structure and Purpose | HARD | 13 | ad4f7362 | 1997 | 2262 | sí | …me unseen" and "secret fire" points to Dido s growing feelings for Aeneas that d |
| cmsjro2ra03nuqmt1hsrovf77 | Text Structure and Purpose | MEDIUM | 7 | c6bd3447 | 1852 | 2351 | sí | …elt about the ’ group s full conversation about art. Instead, the text explains  |
| cmsjro2rk03o4qmt1oqzk8o7a | Text Structure and Purpose | MEDIUM | 9 | c0e1b70a | 1559 | 1809 | sí | …tor indicates that the two countries differ “widely” and likens them to “two sep |
| cmsjro2sk03p8qmt1s5revry0 | Text Structure and Purpose | MEDIUM | 17 | dcd9ad50 | 1402 | 3063 | sí | …escribes behaviors that suggest how he cultivates that regard. Choice B is incor |
| cmsjro3a4041lqmt1uvzb9bws | Words in Context | EASY | 7 | e386a11d | 2355 | 2536 | sí | …igments to a silk scroll. It wouldn t ’ make sense to say that Hishida s use of  |
| cmsjro3gs0466qmt1yx4vdrdc | Words in Context | EASY | 40 | 6cf906fc | 1413 | 1950 | sí | …tionate, or loving and tender. In the text, the immediate context in which the w |
| cmsjro5in05cxqmt1ibjhryjh | Words in Context | HARD | 5 | 6c086e70 | 2291 | 2334 | sí | …heir own marketing in pursuit of that goal. |
| cmsjro5nb05elqmt1mbqd3bp6 | Words in Context | HARD | 17 | 54804e10 | 2276 | 2434 | sí | …he Tikal citadel provides evidence of the Tikal people s ’ “animosities toward,  |
| cmsjro5ok05fkqmt1bzdegu4q | Words in Context | HARD | 24 | b411eb09 | 2317 | 2810 | sí | …tions below sea level. The text’s use of the words “though” and “many” suggests  |
| cmsjro5ri05iwqmt1myhwpl0n | Words in Context | HARD | 48 | 6017ae31 | 2305 | 2475 | sí | … high degree of confidence, suggests the likelihood that the chirping sound was  |
| cmsjro5s005jlqmt1oowpb9zp | Words in Context | HARD | 53 | b35e2fdc | 2314 | 2771 | sí | …on, ” which would suggest its importance, the text doesn t ’ ’ suggest that the  |
| cmsjro5s305jqqmt1wvr30h33 | Words in Context | HARD | 54 | e8fb0744 | 2289 | 2445 | sí | …uggests that female participation may have been commonplace, that study is prese |
| cmsjro4t804tmqmt1mhve7810 | Words in Context | MEDIUM | 11 | 23974d6c | 2276 | 2470 | sí | …gests that Wang’s recommendations pertain to whether campaigns should or shouldn |
| cmsjro4zt04y7qmt1bmncbj88 | Words in Context | MEDIUM | 44 | 1107e7dc | 2379 | 2423 | sí | …y more on solar energy than they already do. |
