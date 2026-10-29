#!/usr/bin/env python3
import json
import os
import re

# Dictionary mapping priority_rank to (meaning_th, meaning_en)
# Each entry is verified:
# 1. meaning_th must contain Thai script and be concise, accurate, and natural.
# 2. meaning_en must not be empty.
# 3. If category is 'VERB' or expression ends with 'する', meaning_en MUST start with 'to '.

TRANSLATIONS = {
    103: ("ไม่ไหวติง, ไม่เคลื่อนไหว, มั่นคงแน่วแน่", "immovable, motionless, firm"),
    107: ("แตงโม", "watermelon"),
    111: ("คำตอบ, การตอบรับ", "answer, reply, response"),
    115: ("วันอาทิตย์", "Sunday"),
    124: ("ประเทศจีน, ภูมิภาคชูโกกุ (ภาคตะวันตกของเกาะฮอนชู)", "China, Chūgoku region"),
    136: ("การออกมา, การปรากฏตัว, การออกเดินทาง (ภาษาโบราณ)", "emergence, appearance, coming out"),
    144: ("ทางเข้า, ประตูทางเข้า", "entrance, entry, gate"),
    145: ("ครึ่งแรก, ช่วงครึ่งแรก", "first half"),
    4902: ("ที่เรียกว่า..., ที่ว่า...", "called, named, that says"),
    4906: ("ที่เรียกว่า..., ที่บอกว่า... (ภาษาพูด)", "called, named, that says (colloquial)"),
    4918: ("แบบนั้น, เช่นนั้น, อย่างนั้น", "such, like that, that sort of"),
    4919: ("อะไรกัน, อะไรนะ, อะไรเนี่ย", "what is it?, what?, why"),
    4921: ("ยี่สิบ, 20", "twenty, 20"),
    4928: ("แบบนี้, เช่นนี้, อย่างนี้", "such, this sort of, like this"),
    4932: ("สุด ๆ, มาก ๆ, โคตร (ภาษาพูด)", "extremely, very, absurd"),
    4933: ("แบบไหน, อย่างไร, เช่นไร", "what kind of, what sort of, what"),
    4934: ("ไม่...เลยสักนิด, ไม่มีอะไรเลย", "(not) anything, nothing at all"),
    4936: ("พูดได้, กล่าวได้ว่า, บอกได้ว่า", "can be said, can say, to be able to say"),
    4940: ("สามสิบ, 30", "thirty, 30"),
    4944: ("หลังจากนั้น, ภายหลังจากนั้น", "after that, afterwards, thereafter"),
    4948: ("เช่น..., เป็นต้นว่า...", "like, such as, and the like"),
    4949: ("เมื่อวันก่อน, เมื่อไม่นานมานี้", "the other day, recently, lately"),
    4952: ("ใช้ได้, สามารถใช้ได้, มีประโยชน์", "to be able to use, to be usable, to be useful"),
    4954: ("หกสิบ, 60", "sixty, 60"),
    4955: ("รู้ตัว, สังเกตเห็น, ตระหนักได้", "to notice, to realize, to perceive"),
    4956: ("ดูเหมือนว่า, รู้สึกเหมือนว่า", "to seem, to appear, to feel like"),
    4958: ("ห้าสิบ, 50", "fifty, 50"),
    4959: ("นกกะเต็น (นกกินปลา)", "kingfisher (bird)"),
    4971: ("จ้องมอง, เพ่งมอง, จ้องดู", "to stare (at), to gaze (at), to look hard (at)"),
    4972: ("อะไรจะ...ขนาดนั้น!, ช่าง...จริง ๆ, อย่างไร", "what, how, what a...!"),
    4973: ("สี่สิบ, 40", "forty, 40"),
    4975: ("กี่ครั้ง, หลายครั้ง, กี่องศา", "how many times, several times, what degree"),
    4976: ("แปดสิบ, 80", "eighty, 80"),
    4978: ("การเริ่มต้น, ช่วงเริ่มต้น, จุดเริ่มต้น", "start, beginning, opening"),
    4985: ("สองร้อย, 200", "two hundred, 200"),
    4991: ("งานสังสรรค์ดื่มกิน, งานเลี้ยงสังสรรค์", "drinking party, get-together"),
    4992: ("ตัวสิ่งนั้นเอง, โดยเนื้อแท้", "the very thing, itself"),
    4994: ("เจ็ดสิบ, 70", "seventy, 70"),
    4995: ("แม้ว่า..., ถึงแม้จะ...ก็ตาม", "even if, even though, although"),
    4997: ("โกโบ, รากโกโบ (ผักรากไม้ญี่ปุ่น)", "burdock, burdock root"),
    5001: ("ภาษาญี่ปุ่น", "Japanese language"),
    5003: ("นกติ๊ดหลังเทาญี่ปุ่น", "Japanese tit (bird)"),
    5004: ("จิ้งโจ้น้ำ (แมลง)", "water strider, pond skater"),
    5006: ("ถึงกระนั้นก็ดี, แม้จะว่าอย่างนั้นก็ตาม", "though, although, nonetheless"),
    5013: ("คนญี่ปุ่น, ชาวญี่ปุ่น", "Japanese person, Japanese people"),
    5018: ("นิทาน, เรื่องเล่า, การพูดคุย", "story, tale, talk"),
    5022: ("เก้าสิบ, 90", "ninety, 90"),
    5024: ("ในเวลาเดียวกัน, พร้อมกัน", "at the same time, simultaneously"),
    5027: ("ท่าทีสำคัญตัว, การวางท่าโอ้อวด", "airs, pretension, gravity"),
    5029: ("ไปได้, สามารถไปได้, ใช้การได้ดี, คอแข็ง", "to be able to go, to go well, to be good"),
    5030: ("สามร้อย, 300", "three hundred, 300"),
    5035: ("อีกครั้งหนึ่ง, อีกที", "once more, again"),
    5043: ("พวกเด็ก ๆ, เหล่าเด็ก ๆ", "children, kids"),
    5045: ("เป็ดมัลลาร์ด, เป็ดป่าหัวเขียว", "mallard, wild duck"),
    5057: ("ข้าวสวย, มื้ออาหาร", "cooked rice, meal"),
    5059: ("หนังสือเล่มนี้, ตำราเล่มนี้", "this book, main text"),
    18821: ("สามารถ...ได้, ทำได้", "to be able to, to be possible to"),
    18822: ("สามารถ...ได้, ทำได้", "to be able to, to be possible to"),
    18823: ("สามารถ...ได้, ทำได้", "to be able to, to be possible to"),
    18832: ("ได้รับการกำหนดว่า, ผลปรากฏว่า, กลายเป็นว่า", "to be decided that, to result in"),
    18844: ("เคย...มาก่อน, มีบางครั้งที่...", "to have done (before), to happen on occasion"),
    18851: ("เต็มเปี่ยม, มากมาย; หนึ่งแก้ว/หนึ่งชาม", "full, a lot; one cup/bowl of"),
    18852: ("นั่นหมายความว่า..., นั่นเป็นเพราะว่า...", "that is to say, because, meaning that"),
    18855: ("ไม่จำเป็นต้อง..., ไม่มีทางที่จะ...", "there is no need to, never happens"),
    18856: ("ไม่จำเป็นต้อง..., ไม่มีทางที่จะ...", "there is no need to, never happens"),
    18858: ("รู้สึกเหมือนว่า, รู้สึกว่า", "to feel like, to have a feeling (that), to seem"),
    18873: ("คนเดียว, โดยลำพัง", "alone, by oneself"),
    18876: ("พวกเรา", "we, us"),
    18884: ("สิ่งที่เรียกว่า..., ของอย่าง...", "something called, thing like"),
    18885: ("สิ่งที่เรียกว่า..., ของอย่าง...", "something called, thing like"),
    18886: ("จนถึงตอนนี้, จนถึงบัดนี้", "until now, up to now"),
    18893: ("เต็มเปี่ยม; เครื่องดื่มหนึ่งแก้ว/หนึ่งจอก", "full; one cup of, one drink"),
    18900: ("ในตอนนั้น, ในเวลานั้น", "at that time, then"),
    18901: ("ช่วยไม่ได้, ไม่มีทางเลือกอื่น", "cannot be helped, unavoidable"),
    18908: ("คาใจ, กังวลใจ, ติดใจ, อยากรู้", "being on one's mind, worrying, being curious"),
    18913: ("ทีเดียว, ค่อนข้าง, ไม่ง่ายเลยที่จะ...", "considerably, quite, not easily"),
    18914: ("ใส่ใจ, นำมาคิดมาก, กังวล, แคร์", "to worry about, to mind, to care about"),
    18917: ("จริง ๆ, เรื่องจริง, ความจริง", "really, truly, truth, reality"),
    18922: ("คนนั้น, เขาคนนั้น", "that person, he, she"),
    18925: ("นั่นหมายความว่า..., แสดงว่า...", "that is to say, which means"),
    18927: ("ต่าง ๆ นานา, หลากหลาย", "various, a variety of, all sorts of"),
    18928: ("ต่าง ๆ นานา, หลากหลาย", "various, a variety of, all sorts of"),
    18933: ("มากไปกว่านี้, เกินกว่านี้", "more than this, any more, any further"),
    18949: ("ตัดสินใจว่าจะ..., ตั้งใจว่าจะ...", "to decide to, to make a practice of"),
    18952: ("ผู้คน, พวกคน", "people"),
    18962: ("ควรจะ...ดีกว่า, ดีกว่า", "had better, should"),
    18963: ("อาจจะ..., บางทีอาจจะ...", "may, might, perhaps"),
    18968: ("ในที่สุด, ท้ายที่สุด", "finally, at last, in the end"),
    18969: ("คนคนนั้น, คนผู้นั้น", "that person, he, she"),
    18972: ("คนคนนี้, คนผู้นี้", "this person"),
    18973: ("พวกแก, พวกเอ็ง, พวกนาย", "you guys, you all (blunt/informal)"),
    18977: ("เด็กคนนั้น, คนคนนั้น", "that child, that girl/boy"),
    18978: ("สามคน", "three people"),
    18982: ("ไม่เคย...มาก่อน, ไม่เคยมีเรื่องเช่นนั้น", "have never done, never happens"),
    18983: ("ไม่เคย...มาก่อน, ไม่เคยมีเรื่องเช่นนั้น", "have never done, never happens"),
    18985: ("สมกับเป็น..., อย่างที่คิดไว้จริง ๆ", "as expected, truly worthy of"),
    18990: ("กิน, รับประทาน; เอ่ยปาก, พูดถึง", "to eat, to taste; to speak of, to mention"),
    18998: ("ควรจะ...ดีกว่า, ดีกว่า", "had better, should"),
    19004: ("ระมัดระวัง, ระวังตัว, เอาใจใส่", "to be careful, to pay attention, to take care"),
    19007: ("ไม่มีปัญหา, ไม่เป็นไร", "no problem, all right, not an issue"),
    19011: ("ข้างหน้านี้, ต่อจากนี้ไป, ในอนาคต", "ahead, beyond this point, in the future"),
    19012: ("ห้าพัน, 5,000", "five thousand, 5,000"),
    19014: ("ชวนให้รู้สึกว่า..., มีแง่มุมที่ทำให้รู้สึกว่า...", "there is something that makes one feel, to feel like"),
    19015: ("แต่ดั้งเดิม, แต่แรกเริ่ม", "originally, from the beginning"),
    19023: ("ตรงจุดนั้น, ณ ที่ตรงนั้น, ทันทีตรงนั้น", "that place, on the spot, then and there"),
    19024: ("พี่ชาย (คำเรียกอย่างสนิทสนม)", "older brother, big brother (affectionate)"),
    19026: ("สวัสดีตอนเช้า (สุภาพ)", "good morning (polite)"),
    19034: ("ในนั้น, ในบรรดาสิ่งเหล่านั้น", "inside, among them, therein"),
    106: ("สัตว์", "animal"),
    108: ("เซนเซอร์, อุปกรณ์ตรวจจับ", "sensor"),
    109: ("การเข้าถึง, การเดินทางไปถึง, การเข้าสู่ระบบ", "access (to a place or online)"),
    110: ("คบหา, ไปเป็นเพื่อน, คบเป็นแฟน", "to associate with, to go out with, to keep company with"),
    112: ("กรรมการบริหาร, เจ้าหน้าที่บริหาร, ผู้บริหาร", "director, executive, officer"),
    113: ("แสงเหนือแสงใต้, ออโรรา", "aurora, polar lights"),
    117: ("ยางมะตอย", "asphalt"),
    118: ("การคลิก (เมาส์)", "click (mouse), to click"),
    119: ("บล็อก (เว็บไซต์บันทึกออนไลน์)", "blog"),
    120: ("เสา, เสากลม", "pole"),
    127: ("เพลง", "song"),
    128: ("งานธุรการ, งานสำนักงาน", "office work, clerical work, administration"),
    131: ("หาพบ, ค้นพบ, มองเห็น", "to find, to discover, to come across"),
    133: ("หลอด, ท่อ", "tube"),
    137: ("การเปิด (ร้าน/กิจการ), เปิดเผย, ตรงไปตรงมา", "open, opening (a store), frank"),
    138: ("เวอร์ชัน, รุ่น", "version"),
    139: ("อธิบดี, ผู้อำนวยการสำนัก/กรม", "bureau director, office chief"),
    140: ("บทเพลง, เพลง, ทำนอง", "song, piece of music, tune"),
    141: ("พวก... (คำต่อท้ายแสดงพหูพจน์อย่างถ่อมตน), ทั้งสอง", "companions, plural suffix (humble), both"),
    142: ("ตารางลำดับเหตุการณ์ตามเวลา, พงศาวดารย่อ", "chronological table, timeline"),
    146: ("ไม่อั้น, ตามใจชอบ, ได้เต็มที่", "all-you-can (eat/drink), as much as one likes, unlimited"),
    147: ("ให้ทำ, บังคับให้ทำ, ยอมให้ทำ", "to make (someone) do, to let (someone) do"),
    148: ("ยังคงอีกมาก, ยัง...ไม่ได้ที่, ยังห่างไกล", "still, much more, not yet"),
    150: ("การปรับปรุงใหม่, การรีโนเวท, การปรับโฉมใหม่", "renewal, renovation, makeover"),
    151: ("ทัวร์, การท่องเที่ยวเป็นคณะ", "tour"),
    152: ("กระดาษสาญี่ปุ่น, วาชิ", "washi, Japanese traditional paper"),
    154: ("สีเขียว, พื้นที่สีเขียว", "green (color), greenery"),
    155: ("กล้วย", "banana"),
    156: ("โบว์ลิ่ง", "bowling"),
    162: ("มะเขือเทศ", "tomato"),
    163: ("ความคิด, ความรู้สึก, จิตใจ", "thought, feeling, affection, sentiment"),
    164: ("เหรียญรางวัล, เหรียญ", "medal"),
    166: ("เท้าขวา, ขาขวา", "right foot, right leg"),
    167: ("เมืองนาโกย่า", "Nagoya (city)"),
    168: ("ความสงบสุข, สันติสุข; ยุคเฮอัน", "peace, tranquility; Heian era"),
    169: ("ที่นั่ง, ตำแหน่ง; กลุ่มดาว, คณะละคร", "seat, place; constellation, troupe"),
    170: ("จับ, ดักจับ, ยึดกุม, จับใจความ", "to catch, to capture, to seize"),
    174: ("ตั๋ว, บัตร", "ticket"),
    175: ("การตรวจสอบ, การเช็ก, ลายสก็อต", "check, inspection, plaid pattern"),
    176: ("ยามาโตะ, ประเทศญี่ปุ่นโบราณ", "Yamato, ancient Japan"),
    178: ("บัญชีผู้ใช้, แอ็กเคานต์", "account (digital or financial)"),
    179: ("การแสดง, ประสิทธิภาพการทำงาน, สมรรถนะ", "performance, show, capability"),
    180: ("สนาม, ทุ่งกว้าง, สายงาน/ขอบเขต", "field, domain"),
    182: ("ปี; หู", "year; ear"),
    184: ("ลอย, ผุดขึ้นมา, แวบเข้ามาในหัว", "to float, to rise to the surface, to come to mind"),
    185: ("ฉาก (ภาพยนตร์/ละคร), เหตุการณ์", "scene, sight, scenario"),
    186: ("หลัก, สำคัญที่สุด, จานหลัก", "main, principal, main dish"),
    190: ("คณะทำงาน, พนักงาน, เจ้าหน้าที่", "staff, personnel"),
    191: ("การโทร, การขานเรียก, เสียงเชียร์", "call, shout, chant"),
    192: ("โดม, หลังคาโค้งรูปโดม, สเตเดียมรูปโดม", "dome, dome stadium"),
    193: ("เท้าซ้าย, ขาซ้าย", "left foot, left leg"),
    194: ("อสังหาริมทรัพย์, ทรัพย์สิน, ห้องเช่า/บ้านเช่า", "property, real estate, article"),
    197: ("กินซ่า (ย่านช้อปปิ้งชื่อดังในโตเกียว)", "Ginza (Tokyo district)"),
    199: ("กลอง, ชุดกลอง", "drum, drums"),
    200: ("คำ, คำศัพท์, โปรแกรมเวิร์ด", "word"),
    204: ("สวนสนุก, สวนพักผ่อนหย่อนใจ", "amusement park, pleasure garden"),
    205: ("ได้ผล, มีผลชะงัด, ใช้งานได้ดี", "to be effective, to function, to work well"),
    206: ("วันจันทร์", "Monday"),
    207: ("เกี๊ยวซ่า", "gyoza, pan-fried dumplings"),
    211: ("ทองและเงิน", "gold and silver"),
    216: ("ขั้นตอนสุดท้าย, การเก็บรายละเอียดงาน, การแต่งผิวสำเร็จ", "finishing touches, completion, finish"),
    218: ("ช่องท้อง, บริเวณหน้าท้อง", "abdomen, belly, abdominal area"),
    219: ("เวิร์กช็อป, การประชุมเชิงปฏิบัติการ", "workshop"),
    220: ("คนรู้จัก", "acquaintance"),
    223: ("ผู้สนับสนุน, กองเชียร์, ปลอกพยุงข้อ", "supporter (fan or athletic band)"),
    224: ("สั้น, ผมสั้น, ไฟฟ้าลัดวงจร", "short, short hair, short circuit"),
    225: ("รถมอเตอร์ไซค์, รถจักรยานยนต์", "motorcycle, motorbike"),
    227: ("ทางออกทิศใต้, ทางเข้าทิศใต้", "south entrance, south exit"),
    228: ("เสาร์-อาทิตย์, วันหยุดสุดสัปดาห์", "weekend, Saturday and Sunday"),
    229: ("ฝั่งซ้าย, ด้านซ้ายมือ", "left side, left-hand side"),
    230: ("แต่เนิ่น ๆ, เร็วกว่าปกติ", "early, ahead of time"),
    231: ("ทิศตะวันออกเฉียงเหนือ, ภูมิภาคโทโฮกุ", "northeast, Tohoku region"),
    232: ("นกแว่นตาขาวญี่ปุ่น (นกเมจิโระ)", "Japanese white-eye (bird)"),
    236: ("นักเปียโน", "pianist"),
    237: ("พิตเชอร์ (คนขว้างเบสบอล), เหยือกน้ำ", "pitcher (baseball), water jug"),
    238: ("บล็อก, ก้อนคอนกรีต, การปิดกั้น", "block, concrete block, to block"),
    240: ("ลำธารเล็ก ๆ, ห้วย", "brook, stream, creek"),
    241: ("หนังสือภาพ (สำหรับเด็ก)", "picture book"),
    242: ("ถูกพบ, หาเจอ, ปรากฏให้เห็น", "to be found, to be discovered"),
    243: ("เกี่ยวข้องกับ, มีส่วนร่วมใน", "to be involved (in), to relate to, to concern oneself (with)"),
    244: ("รายการ, บัญชีรายชื่อ", "list"),
    246: ("วันพฤหัสบดี", "Thursday"),
    247: ("น้ำสลัด", "salad dressing"),
    248: ("ยุคเฮเซ (ปี ค.ศ. 1989-2019)", "Heisei era (1989-2019)"),
    251: ("เรียบง่าย, ไม่ซับซ้อน", "simple, plain"),
    252: ("แมวมอง, การทาบทามตัว, การสเกาต์", "scout, recruiting, talent scouting"),
    253: ("ไฮไลต์, จุดเด่น, ภาพเหตุการณ์สำคัญ", "highlight"),
    254: ("สันติภาพ, การชูสองนิ้ว, ชิ้นส่วน", "peace, peace sign, piece"),
    255: ("ท่าเรือ, ช่องเชื่อมต่อ (พอร์ตคอมพิวเตอร์)", "port, harbor, connection port"),
    257: ("สวน, สวนหย่อมตกแต่ง", "garden, park"),
    258: ("กรรมการบริหาร, บอร์ดบริหาร", "director, board member, trustee"),
    260: ("เฉียดฉิว, จวนเจียน, คาบเส้น, ฉิวเฉียด", "at the very limit, barely, just in time"),
    261: ("คุณ, ท่าน (คำต่อท้ายยกย่อง)", "Mr., Ms., honorific suffix"),
    262: ("แวบเดียว, กะทันหัน, สว่างวาบ, พรึ่บ", "suddenly, in a flash, quickly"),
    263: ("การซูม (กล้อง), ขยายภาพ", "zoom (camera)"),
    266: ("รสหวาน; ห้องสวีท (โรงแรม)", "sweet (flavour); suite (hotel room)"),
    267: ("ผู้อำนวยการสำนักงาน, หัวหน้าสถาบัน", "head of an office, director, institute chief"),
    270: ("คนชรา, ผู้สูงอายุ, มีอายุมาก", "elderly person, senior citizen, aged"),
    274: ("ช็อกโกแลต", "chocolate"),
    275: ("ถังเปล่า, ถังไม้เปล่า", "empty tub, empty bucket"),
    276: ("ห้องปฏิบัติการ, ห้องแล็บ", "laboratory, lab"),
    277: ("รอบ ๆ, บริเวณรอบ, วงรอบ", "around, surrounding, rotation, round"),
    278: ("การยกเลิก, ยกเลิก", "cancellation, to cancel"),
    279: ("ระดับโลก, สากล, ทั่วโลก", "global, worldwide"),
    280: ("เจล", "gel"),
    281: ("สมุนไพร", "herb"),
    282: ("เพสต์, แป้งเปียก, การวาง (ข้อความ)", "paste"),
    283: ("ม้วน, ขนมปังโรล, บทบาท", "roll (bread, ribbon, rolling), role"),
    284: ("แครอท, โสม", "carrot, ginseng"),
    288: ("ชมการแข่งขัน (กีฬา), ดูการแข่งขัน", "to watch (a sports game), to spectate"),
    289: ("ผู้พูด, เจ้าของภาษา/ผู้สื่อสาร", "speaker, narrator"),
    293: ("การสนับสนุน, ความช่วยเหลือ, ฝ่ายสนับสนุน", "support, assistance"),
    294: ("โครงการ, โปรเจกต์", "project"),
    295: ("ภาคเรียนแรก, ครึ่งแรกของปี, ช่วงต้น", "first term, first semester, early period"),
    296: ("กิจกรรมชมรม (ในโรงเรียน/มหาวิทยาลัย)", "club activities (extracurricular)"),
    298: ("ทีมนักแสดง, ผู้แสดง, แคสต์", "cast (actors), casting"),
    299: ("ฟุตบอล, กีฬาฟุตบอล", "soccer, football"),
    300: ("ตรง, ตรงไปตรงมา, ไม่มีอ้อมค้อม", "straight, direct, straightforward")
}

def main():
    chunk_path = "backend_data/chunk_n5_n4_part1.json"
    out_path = "backend_data/translated_n5_n4_part1.json"

    with open(chunk_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    print(f"Loaded {len(items)} items from {chunk_path}")
    print(f"Total translations in dictionary: {len(TRANSLATIONS)}")

    thai_regex = re.compile(r"[\u0E00-\u0E7F]")

    results = []
    missing_ranks = []
    validation_errors = []

    for idx, item in enumerate(items):
        rank = item["priority_rank"]
        expr = item["expression"]
        reading = item["reading"]
        category = item["category"]
        level = item["predicted_level"]

        if rank not in TRANSLATIONS:
            missing_ranks.append((idx, rank, expr))
            continue

        th, en = TRANSLATIONS[rank]

        # Validation rules:
        if not th or not th.strip():
            validation_errors.append(f"Row {idx} ({expr}, rank {rank}): empty meaning_th")
        if not thai_regex.search(th):
            validation_errors.append(f"Row {idx} ({expr}, rank {rank}): meaning_th has no Thai script: '{th}'")
        if not en or not en.strip():
            validation_errors.append(f"Row {idx} ({expr}, rank {rank}): empty meaning_en")

        is_verb = category == "VERB" or expr.endswith("する")
        if is_verb and not en.strip().lower().startswith("to "):
            validation_errors.append(f"Row {idx} ({expr}, rank {rank}): verb meaning_en must start with 'to ': '{en}'")

        entry = {
            "priority_rank": int(rank),
            "expression": expr,
            "reading": reading,
            "category": category,
            "predicted_level": level,
            "meaning_th": th.strip(),
            "meaning_en": en.strip()
        }
        results.append(entry)

    if missing_ranks:
        print(f"ERROR: Missing translations for {len(missing_ranks)} items:")
        for m in missing_ranks:
            print(" ", m)
        return False

    if validation_errors:
        print(f"ERROR: Validation failed with {len(validation_errors)} errors:")
        for err in validation_errors:
            print(" ", err)
        return False

    if len(results) != 226:
        print(f"ERROR: Expected 226 items, got {len(results)}")
        return False

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"SUCCESS: Saved {len(results)} translated items to {out_path}")
    return True

if __name__ == "__main__":
    success = main()
    if not success:
        exit(1)
