"""Little Escapes room specs — data, not code (storybook-pipeline style).

Chain rules (from persistence-of-dreams' generate-scenario skill, scaled
to age 3-6): linear dependency, collect→use→unlock, 2-3 items each used
exactly ONCE, one win spot, tray never holds more than 3, plus one free
"flavor" search spot per room so wrong taps stay fun. Scene prompts
compose every hotspot object LEFT→RIGHT, large and clearly separated
(SAM needs discrete solid objects — no region phrases).

NOTE: `anim` prompts go through Veo, so door/key wording must be
sanitized in the generator (globe-style: key→charm, padlock→latch).
The `after` prompts are NBP-only (no Veo filter issue).
"""

ESCAPE_STYLE = ("Bright cheerful children's picture-book illustration, chunky "
                "rounded shapes, bold clean outlines, soft warm palette. "
                "Landscape orientation. No text, no letters, no watermark, "
                "no people.")

ESCAPE_ROOMS = [
    {
        "id": "toyroom",
        "name": "The Sleepy Puppy",
        "level": "easy",
        "scene": ("A wide pastel toy room viewed from the front, four objects placed far apart "
                  "with lots of empty floor between them: on the far LEFT EDGE a big blue "
                  "striped pillow sitting alone on the floor, in the CENTER a big red wooden "
                  "toy chest with a golden padlock sitting alone on the floor, on the RIGHT a "
                  "brown teddy bear sitting alone on a round green rug, on the far RIGHT EDGE "
                  "a golden puppy inside a tall wooden fence pen. Each object is a separate "
                  "standalone item with wide empty space on all sides, evenly spaced across "
                  "the full width of the room."),
        "intro": "Oh no! The puppy is stuck in the toy pen and the gate will not budge. Look around the toy room and help him out!",
        "winText": "Hooray! The puppy is free and SO happy!",
        "items": [
            {"id": "key", "label": "A shiny key!", "emoji": "🗝️"},
            {"id": "bone", "label": "A yummy bone!", "emoji": "🦴"},
        ],
        "hotspots": [
            {"id": "pillow", "spot": "blue striped pillow", "kind": "search", "gives": "key",
             "pop": "a big shiny golden key with a heart-shaped top",
             "sayFound": "A shiny key was hiding under the pillow!"},
            {"id": "teddy", "spot": "brown teddy bear", "kind": "search",
             "saySearch": "The teddy bear giggles. Nothing under here!"},
            {"id": "chest", "spot": "red toy chest", "kind": "lock", "needs": "key", "gives": "bone",
             "pop": "a big happy cartoon bone with a red bow",
             "sayLocked": "The toy chest is locked tight. What could open it?",
             "sayFound": "The chest popped open — a yummy bone!",
             "after": "the red wooden toy chest is now wide open with the lid raised up, showing an empty interior",
             "anim": "the toy chest's lid swings open and the padlock falls away, revealing the inside"},
            {"id": "pen", "spot": "golden puppy", "kind": "win", "needs": "bone",
             "sayLocked": "The puppy is hungry. What does a puppy love best?",
             "sayFound": "The puppy wiggles out — you saved him!",
             "after": "the wooden fence gate of the pen is swung wide open, showing an opening in the fence",
             "anim": "the gate swings open and the puppy hops out wagging its tail happily"},
        ],
    },
    {
        "id": "dragoncave",
        "name": "Dragon's Breakfast",
        "level": "easy",
        "scene": ("A wide dragon cave viewed from the front, four objects placed far apart: "
                  "on the far LEFT EDGE a big golden haystack sitting on the cave floor, "
                  "in the LEFT-CENTER a round glowing purple crystal ball on a stone pedestal, "
                  "in the RIGHT-CENTER a big copper stove sitting alone on the floor, on the "
                  "far RIGHT EDGE a small teal baby dragon sitting on a stone stool. Each "
                  "object is a separate standalone item with clear empty space on all sides."),
        "intro": "The baby dragon is too hungry to fly! Find something yummy and cook him breakfast.",
        "winText": "Yum! The baby dragon is full and zooming again!",
        "items": [
            {"id": "egg", "label": "A big egg!", "emoji": "🥚"},
            {"id": "pancake", "label": "A golden pancake!", "emoji": "🥞"},
        ],
        "hotspots": [
            {"id": "haystack", "spot": "golden haystack", "kind": "search", "gives": "egg",
             "pop": "a big white egg with tiny speckles",
             "sayFound": "An egg was hiding in the hay!"},
            {"id": "crystal", "spot": "purple crystal ball", "kind": "search",
             "saySearch": "The crystal ball shows a yummy breakfast!"},
            {"id": "stove", "spot": "copper stove", "kind": "lock", "needs": "egg", "gives": "pancake",
             "pop": "a golden pancake with melting butter on top",
             "sayLocked": "The stove is ready, but what could we cook?",
             "sayFound": "Sizzle sizzle — a golden pancake!",
             "after": "the copper stove is now lit with warm orange flames through the grate, a golden pancake sizzling in a pan on top",
             "anim": "the stove bursts to life with warm flames and a pan sizzles as a golden pancake puffs up"},
            {"id": "dragon", "spot": "teal baby dragon", "kind": "win", "needs": "pancake",
             "sayLocked": "The baby dragon's tummy is rumbling…",
             "sayFound": "The dragon gobbles it up and puffs a happy little smoke ring!",
             "after": "the teal baby dragon happily munching a golden pancake with eyes closed in delight, tiny puff of smoke from its nostrils",
             "anim": "the baby dragon gobbles the pancake in one big chomp and puffs a happy little smoke ring"},
        ],
    },
    {
        "id": "rocketpad",
        "name": "Bunny Blast-Off",
        "level": "medium",
        "scene": ("A wide bright rocket hangar viewed from the front, five objects placed far "
                  "apart in a single row across the scene: on the far LEFT EDGE a big red "
                  "toolbox sitting open on the floor, in the LEFT-CENTER a big round yellow "
                  "poster of the moon hanging high on the wall, in the CENTER a tall silver "
                  "rocket standing alone, in the RIGHT-CENTER a big green battery sitting on "
                  "a wooden crate, on the far RIGHT EDGE a big round blue button on a tall "
                  "white stand. Each object is a separate standalone item with wide empty "
                  "space on all sides, evenly spaced across the full width."),
        "intro": "The bunny's rocket will not start! Find what it needs and help her blast off to the moon.",
        "winText": "Whoosh! The bunny zooms to the moon — thanks to you!",
        "items": [
            {"id": "wrench", "label": "A trusty wrench!", "emoji": "🔧"},
            {"id": "battery", "label": "A super battery!", "emoji": "🔋"},
            {"id": "star", "label": "A glowing star!", "emoji": "⭐"},
        ],
        "hotspots": [
            {"id": "toolbox", "spot": "red toolbox", "kind": "search", "gives": "wrench",
             "pop": "a big red wrench with a smiling face",
             "sayFound": "A trusty wrench!"},
            {"id": "poster", "spot": "yellow moon poster", "kind": "search",
             "saySearch": "That is where the bunny wants to go!"},
            {"id": "rocket", "spot": "silver rocket", "kind": "lock", "needs": "wrench", "gives": "battery",
             "pop": "a chunky green battery with a lightning bolt",
             "sayLocked": "The rocket panel is stuck. We need a tool!",
             "sayFound": "The panel opened — a super battery!",
             "after": "the silver rocket has an open side panel revealing colorful wires and circuits inside",
             "anim": "the rocket's side panel pops open with a click, revealing colorful wires sparking inside"},
            {"id": "crate", "spot": "green battery", "kind": "lock", "needs": "battery", "gives": "star",
             "pop": "a glowing golden star with a happy face",
             "sayLocked": "The power slot is empty…",
             "sayFound": "Power on! A glowing star popped out!",
             "after": "the green battery is now glowing brightly with a visible lightning bolt, sitting on the wooden crate",
             "anim": "the battery slots into the crate with a satisfying click and lights up with a bright lightning glow"},
            {"id": "button", "spot": "blue button", "kind": "win", "needs": "star",
             "sayLocked": "The launch button needs star power!",
             "sayFound": "Three, two, one — BLAST OFF!",
             "after": "the big round blue button is pressed down and glowing bright with star power energy",
             "anim": "the button presses down with a flash and the whole scene lights up with star power energy"},
        ],
    },
    {
        "id": "piratecove",
        "name": "The Pelican Trade",
        "level": "medium",
        "scene": ("A wide sunny pirate cove beach viewed from the front, four objects placed "
                  "far apart in a single row across the golden sand: on the far LEFT EDGE a "
                  "big grey rock with a green fishing net draped over it, in the LEFT-CENTER "
                  "a big red striped beach umbrella stuck in the sand, in the RIGHT-CENTER a "
                  "big white pelican standing on a wooden post, on the far RIGHT EDGE a big "
                  "brown wooden treasure chest half buried in golden sand. Each object is a "
                  "separate standalone item with wide empty space on all sides, evenly spaced "
                  "across the full width."),
        "intro": "A treasure chest washed up on the beach, but it will not open! Look around the cove for a way in.",
        "winText": "Treasure! You are the cleverest little pirate!",
        "items": [
            {"id": "fish", "label": "A wiggly fish!", "emoji": "🐟"},
            {"id": "shell", "label": "A shiny shell!", "emoji": "🐚"},
        ],
        "hotspots": [
            {"id": "net", "spot": "green fishing net", "kind": "search", "gives": "fish",
             "pop": "a silly smiling blue fish",
             "sayFound": "A wiggly fish!"},
            {"id": "umbrella", "spot": "red beach umbrella", "kind": "search",
             "saySearch": "Just a shady spot. Nothing hidden here!"},
            {"id": "pelican", "spot": "white pelican", "kind": "lock", "needs": "fish", "gives": "shell",
             "pop": "a shiny rainbow seashell sparkling with light",
             "sayLocked": "The pelican wants a snack first…",
             "sayFound": "The pelican trades you a shiny shell!",
             "after": "the white pelican happily holding a blue fish in its beak, looking pleased and well-fed",
             "anim": "the pelican catches the fish in its beak with a happy gulp and drops a shiny shell"},
            {"id": "chest", "spot": "brown treasure chest", "kind": "win", "needs": "shell",
             "sayLocked": "The treasure chest has a shell-shaped slot!",
             "sayFound": "The chest bursts open — treasure for everyone!",
             "after": "the brown treasure chest burst wide open, overflowing with gold coins, sparkling gems and treasure",
             "anim": "the treasure chest bursts open and gold coins and sparkling gems spill out everywhere"},
        ],
    },
]

# Translations for escape rooms — keyed by room id, each has nameT +
# per-field t tables matching the manifest structure. The generator
# merges these into the manifest; keeping them beside the specs means
# new rooms carry translations from the start.
ESCAPE_TRANSLATIONS = {
    "toyroom": {
        "nameT": {"ja": "ねむたい わんちゃん", "cmn": "瞌睡狗", "yue": "眼瞓狗狗"},
        "t": {
            "ja": {
                "intro": "たいへん！ わんちゃん、おもちゃの さくの なかだ。 ドアが あかないよ。 おもちゃべやを みて、たすけてあげてね！",
                "winText": "やったー！ わんちゃん じゆうに なった！ とっても うれしそう！",
            },
            "cmn": {
                "intro": "糟糕！小狗被困住啦。门打不开。快在玩具房里找找，帮他出来吧！",
                "winText": "太棒了！小狗自由啦，它好开心呀！",
            },
            "yue": {
                "intro": "唔好啦！狗狗俾困住咗。道門郁都唔郁。快啲喺玩具房搵吓，幫佢出嚟啦！",
                "winText": "太好啦！狗狗自由啦，好開心呀！",
            },
        },
        "items": {
            "key": {"ja": "ぴかぴかの かぎ！", "cmn": "一把闪亮的钥匙！", "yue": "一把閃閃嘅鎖匙！"},
            "bone": {"ja": "おいしい ほね！", "cmn": "一块美味的骨头！", "yue": "一條好味嘅骨頭！"},
        },
        "hotspots": {
            "pillow": {"sayFound": {"ja": "ぴかぴかの かぎが まくらの したに かくれてた！", "cmn": "一把闪亮的钥匙藏在枕头下面！", "yue": "一把閃閃嘅鎖匙收埋咗喺枕頭底呀！"}},
            "teddy": {"saySearch": {"ja": "くまさん、くすくす わらうよ。ここには なにも ないよ！", "cmn": "小熊咯咯地笑。这里什么都没有！", "yue": "啤啤熊咯咯咁笑。呢度乜都冇呀！"}},
            "chest": {
                "sayFound": {"ja": "たからばこが パカッと あいた！ おいしい ほね！", "cmn": "箱子打开了！一块美味的骨头！", "yue": "個箱打開咗啦！一條好味嘅骨頭！"},
                "sayLocked": {"ja": "おもちゃばこが かたく しまってるよ。 なにで あくかな？", "cmn": "玩具箱锁得紧紧的。什么能打开它呢？", "yue": "玩具箱鎖到實一實呀。用咩可以打開佢呢？"},
            },
            "pen": {
                "sayFound": {"ja": "わんちゃん、するするっと でてきた！ たすけてあげたね！", "cmn": "小狗扭动着出来了！你救了他！", "yue": "狗狗捐咗出嚟啦！你救咗佢啦！"},
                "sayLocked": {"ja": "わんちゃん おなかすいたみたい。 なにが いちばん すきかな？", "cmn": "小狗肚子饿了。小狗最喜欢什么呢？", "yue": "狗狗肚餓啦。狗狗最鍾意食咩㗎？"},
            },
        },
    },
    "dragoncave": {
        "nameT": {"ja": "ドラゴン の あさごはん", "cmn": "龙的早餐", "yue": "龍仔嘅早餐"},
        "t": {
            "ja": {"intro": "あかちゃん ドラゴン おなかが すいてて とべないよ！ おいしいもの みつけて あさごはん つくってあげよう。", "winText": "もぐもぐ！ あかちゃん ドラゴン おなかいっぱい！ また びゅーんって とんでるよ！"},
            "cmn": {"intro": "小飞龙太饿了，飞不动啦！快找些好吃的，给他做早餐吧。", "winText": "嗯！小飞龙吃饱了，又可以飞啦！"},
            "yue": {"intro": "小飛龍太肚餓啦，飛唔到呀！快啲搵啲好嘢食，煮早餐俾佢啦。", "winText": "嘩！小飛龍食飽飽啦，又可以飛嚟飛去啦！"},
        },
        "items": {
            "egg": {"ja": "おおきな たまご！", "cmn": "一个大鸡蛋！", "yue": "一隻大蛋！"},
            "pancake": {"ja": "きんいろの パンケーキ！", "cmn": "一个金色的煎饼！", "yue": "一個金黃色嘅班戟！"},
        },
        "hotspots": {
            "haystack": {"sayFound": {"ja": "わらの なかに たまごが かくれてた！", "cmn": "稻草里藏着一个蛋！", "yue": "啲草度有隻蛋仔收埋咗呀！"}},
            "crystal": {"saySearch": {"ja": "すいしょうだまに おいしい あさごはんが うつってる！", "cmn": "水晶球里有美味早餐！", "yue": "水晶球仔見到好味嘅早餐呀！"}},
            "stove": {
                "sayFound": {"ja": "じゅうじゅう！ きんいろの パンケーキ！", "cmn": "滋滋滋！一个金色的煎饼！", "yue": "吱吱喳喳！一個金黃色嘅班戟！"},
                "sayLocked": {"ja": "コンロは じゅんびOK！ でも なにを つくろうかな？", "cmn": "炉子准备好了，可是我们能煮什么呢？", "yue": "個爐準備好啦，但係煮啲乜嘢好呢？"},
            },
            "dragon": {
                "sayFound": {"ja": "ドラゴン もぐもぐ たべて、うれしそうに けむりの わっかを ぷかー！", "cmn": "小飞龙大口吃掉，开心地吐出一个小烟圈！", "yue": "龍仔食晒啦，仲開心咁噴咗個煙圈仔添！"},
                "sayLocked": {"ja": "あかちゃん ドラゴン おなかが ぐーぐー いってる…", "cmn": "小飞龙的肚子咕咕叫了…", "yue": "小飛龍個肚仔咕咕聲呀…"},
            },
        },
    },
    "rocketpad": {
        "nameT": {"ja": "うさぎさん ロケット！", "cmn": "兔子火箭！", "yue": "兔仔火箭！"},
        "t": {
            "ja": {"intro": "うさぎさんの ロケット うごかない！ なにか みつけて おつきさまへ しゅっぱつ！", "winText": "ヒューン！ うさぎさん おつきさまへ ビューン！ ありがとう！"},
            "cmn": {"intro": "兔子火箭开不了！ 找东西，帮它飞月亮！", "winText": "嗖！ 兔子飞到月亮啦 — 谢谢你！"},
            "yue": {"intro": "兔仔嘅火箭開唔到呀！ 搵吓佢需要啲乜，幫佢飛上月球啦！", "winText": "嘩！ 兔仔飛咗上月球啦 — 多謝你呀！"},
        },
        "items": {
            "wrench": {"ja": "じょうぶな レンチ！", "cmn": "可靠的扳手！", "yue": "一把好用嘅士巴拿！"},
            "battery": {"ja": "すごい でんち！", "cmn": "一个超级电池！", "yue": "一粒超級電芯！"},
            "star": {"ja": "ぴかぴか ほし！", "cmn": "一个闪亮的星星！", "yue": "一粒閃閃嘅星星！"},
        },
        "hotspots": {
            "toolbox": {"sayFound": {"ja": "じょうぶな レンチ！", "cmn": "可靠的扳手！", "yue": "一把好用嘅士巴拿！"}},
            "poster": {"saySearch": {"ja": "うさぎさん ここに いきたいんだね！", "cmn": "兔子就想去那里！", "yue": "兔仔就係想去嗰度呀！"}},
            "rocket": {
                "sayFound": {"ja": "パネル あいた！ すごい でんち！", "cmn": "面板打开了 — 一个超级电池！", "yue": "塊板開咗啦 — 一粒超級電芯！"},
                "sayLocked": {"ja": "ロケットの パネル あかない。 どうぐが いるね！", "cmn": "火箭面板卡住了。 我们需要工具！", "yue": "火箭塊板卡住咗。 我哋要搵工具！"},
            },
            "crate": {
                "sayFound": {"ja": "スイッチ オン！ ぴかぴか ほしが でてきた！", "cmn": "开机！ 一个闪亮的星星弹出来了！", "yue": "開機！ 一粒閃閃嘅星星彈咗出嚟！"},
                "sayLocked": {"ja": "でんげん スロット からっぽ…", "cmn": "电源槽是空的…", "yue": "電源位空咗…"},
            },
            "button": {
                "sayFound": {"ja": "さん、に、いち — はっしゃ！", "cmn": "三，二，一 — 发射！", "yue": "三，二，一 — 發射！"},
                "sayLocked": {"ja": "はっしゃ ボタンに ほしの ちからが いるよ！", "cmn": "发射按钮需要星星能量！", "yue": "發射掣要星星能量！"},
            },
        },
    },
    "piratecove": {
        "nameT": {"ja": "ペリカン の こうかん", "cmn": "鹈鹕的交易", "yue": "塘鵝嘅交易"},
        "t": {
            "ja": {"intro": "たからばこ が きた けど あかない！ まわり を さがして みて！", "winText": "おたから！ ちっちゃな かいぞくさん、かしこいね！"},
            "cmn": {"intro": "一个宝箱冲上岸了，可是打不开！ 快在海湾附近找找看！", "winText": "宝藏！ 你真是最聪明的小海盗！"},
            "yue": {"intro": "有個寶箱沖咗上岸，但係開唔到！ 快啲喺海灣附近搵吓啦！", "winText": "寶藏呀！ 你係最叻嘅小海盜呀！"},
        },
        "items": {
            "fish": {"ja": "くねくね おさかな！", "cmn": "一条扭来扭去的鱼！", "yue": "一條扭吓扭吓嘅魚仔！"},
            "shell": {"ja": "ぴかぴか の かい！", "cmn": "一个闪亮的贝壳！", "yue": "一個閃閃嘅貝殼！"},
        },
        "hotspots": {
            "net": {"sayFound": {"ja": "くねくね おさかな！", "cmn": "一条扭来扭去的鱼！", "yue": "一條扭吓扭吓嘅魚仔！"}},
            "umbrella": {"saySearch": {"ja": "ただ の ひかげ だね。 ここ には なにも ないよ！", "cmn": "只是一个阴凉的地方。 这里什么也没藏！", "yue": "只係一個陰涼嘅地方。 呢度冇嘢收埋㗎！"}},
            "pelican": {
                "sayFound": {"ja": "ペリカン が ぴかぴか の かい を くれたよ！", "cmn": "鹈鹕跟你交换了一个闪亮的贝壳！", "yue": "塘鵝同你交換咗個閃閃嘅貝殼呀！"},
                "sayLocked": {"ja": "ペリカン さん、まず おやつ が ほしいって！", "cmn": "小鹈鹕想先吃点心呢…", "yue": "塘鵝想食啲嘢先呀…"},
            },
            "chest": {
                "sayFound": {"ja": "たからばこ が パカッと あいた！ みんな の おたから だ！", "cmn": "宝箱砰地一声打开了！ 大家都有宝藏了！", "yue": "個寶箱砰一聲開咗啦！ 大家都有寶藏啦！"},
                "sayLocked": {"ja": "たからばこ には かい の かたち の あな が あるよ！", "cmn": "宝箱上有一个贝壳形状的槽！", "yue": "個寶箱有個貝殼形狀嘅窿呀！"},
            },
        },
    },
}
