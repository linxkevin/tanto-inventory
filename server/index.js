require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

// ── DB ──────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Middleware ───────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// ── DB Init ─────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      name_ja TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_zh TEXT NOT NULL,
      unit TEXT NOT NULL,
      vendor TEXT NOT NULL,
      min_stock INTEGER NOT NULL DEFAULT 2,
      category TEXT NOT NULL DEFAULT '調味料',
      active BOOLEAN NOT NULL DEFAULT true
    );

    -- Add columns if they don't exist (for existing DBs)
    DO $$ BEGIN
      ALTER TABLE items ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '調味料';
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE items ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE items ADD COLUMN IF NOT EXISTS vendor_item_name TEXT DEFAULT '';
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE items ADD COLUMN IF NOT EXISTS vendor_item_code TEXT DEFAULT '';
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE items ADD COLUMN IF NOT EXISTS order_item_name TEXT DEFAULT '';
    EXCEPTION WHEN others THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      month TEXT NOT NULL,
      time TEXT NOT NULL,
      staff_name TEXT,
      location TEXT NOT NULL DEFAULT 'Piikoi',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Add location column if it doesn't exist (for existing DBs)
    DO $$ BEGIN
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'Piikoi';
    EXCEPTION WHEN others THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS session_items (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL,
      current_stock INTEGER,
      staff_stamp TEXT,
      stamp_time TEXT
    );

    CREATE TABLE IF NOT EXISTS vendor_stamps (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      vendor TEXT NOT NULL,
      staff TEXT NOT NULL,
      stamp_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      name_en TEXT,
      name_zh TEXT,
      icon TEXT NOT NULL DEFAULT 'ti-tag',
      sort_order INTEGER NOT NULL DEFAULT 0
    );


    CREATE TABLE IF NOT EXISTS deliveries (
      id            SERIAL PRIMARY KEY,
      vendor        TEXT NOT NULL DEFAULT '',
      item_name     TEXT NOT NULL DEFAULT '',
      item_code     TEXT NOT NULL DEFAULT '',
      unit_price    NUMERIC(10,2),
      quantity      NUMERIC(10,3),
      delivered_date DATE NOT NULL DEFAULT CURRENT_DATE,
      note          TEXT DEFAULT '',
      image_url     TEXT DEFAULT '',
      tax_amount    NUMERIC(10,2) DEFAULT 0,
      subtotal      NUMERIC(10,2) DEFAULT 0,
      total         NUMERIC(10,2) DEFAULT 0,
      invoice_no    TEXT DEFAULT '',
      location      TEXT NOT NULL DEFAULT 'Piikoi',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    DO $$ BEGIN
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0;
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'Piikoi';
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS invoice_no TEXT DEFAULT '';
    EXCEPTION WHEN others THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS orders (
      id            SERIAL PRIMARY KEY,
      po_number     TEXT NOT NULL UNIQUE,
      vendor        TEXT NOT NULL,
      location      TEXT NOT NULL DEFAULT 'Piikoi',
      order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      delivery_date DATE,
      person        TEXT DEFAULT '',
      memo          TEXT DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'sent',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    DO $$ BEGIN
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'Piikoi';
    EXCEPTION WHEN others THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS order_items (
      id         SERIAL PRIMARY KEY,
      order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      item_name  TEXT NOT NULL,
      unit       TEXT NOT NULL DEFAULT '',
      quantity   NUMERIC(10,2) NOT NULL,
      note       TEXT DEFAULT ''
    );

    DO $$ BEGIN
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;
    EXCEPTION WHEN others THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0;
    EXCEPTION WHEN others THEN NULL;
    END $$;
    -- Add translation columns if missing
    DO $$ BEGIN
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_zh TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $$;

    -- Seed default categories if empty
    INSERT INTO categories (name, name_en, name_zh, icon, sort_order) VALUES
      ('肉・海鮮', 'Meat & Seafood', '肉类・海鲜', 'ti-meat', 1),
      ('野菜・卵', 'Vegetables & Eggs', '蔬菜・鸡蛋', 'ti-leaf', 2),
      ('麺・米', 'Noodles & Rice', '面条・米饭', 'ti-bowl', 3),
      ('調味料', 'Seasonings', '调味料', 'ti-salt', 4),
      ('乾物・ストック', 'Dry Goods', '干货', 'ti-package', 5),
      ('冷凍・その他', 'Frozen & Other', '冷冻・其他', 'ti-snowflake', 6),
      ('サーバー', 'Server (Bar)', '服务员（酒水）', 'ti-glass-full', 7),
      ('消耗品', 'Supplies', '耗材', 'ti-box', 8)
    ON CONFLICT (name) DO UPDATE SET
      name_en=EXCLUDED.name_en,
      name_zh=EXCLUDED.name_zh,
      icon=EXCLUDED.icon;
  `);
  console.log('✅ DB tables ready');
}

// ── Seed items if empty ──────────────────────────────
async function seedItems() {
  // Always upsert all items to ensure DB is up to date

  const items = [
    // JFC
    [1,'料理酒','Cooking Sake','料酒','箱','JFC',2],
    [2,'本みりん','Mirin','味醂','箱','JFC',2],
    [3,'醤油','Soy Sauce','酱油','箱','JFC',2],
    [4,'片栗粉','Potato Starch','片栗粉','袋','JFC',2],
    [5,'マヨネーズ（大）','Mayonnaise (Large)','蛋黄酱（大）','本','JFC',3],
    [6,'チキンパウダーEX','Chicken Powder EX','鸡粉EX','袋','JFC',2],
    [7,'豆腐','Tofu','豆腐','丁','JFC',12],
    [8,'オニオンフライ','Fried Onion','炸洋葱','袋','JFC',2],
    [9,'シラチャソース','Sriracha Sauce','是拉差辣椒酱','本','JFC',2],
    [10,'味の素','Ajinomoto (MSG)','味精','袋','JFC',2],
    [11,'たこ焼き','Takoyaki','章鱼烧','袋','JFC',2],
    [12,'サーモン','Salmon','三文鱼','袋','JFC',2],
    [13,'アサリ（JFC）','Clams (JFC)','蛤蜊（JFC）','袋','JFC',4],
    [14,'たい焼き','Taiyaki','鲷鱼烧','袋','JFC',2],
    [15,'ごま油','Sesame Oil','芝麻油','本','JFC',2],
    [16,'椎茸','Shiitake Mushroom','香菇','袋','JFC',2],
    [17,'昆布だし','Kombu Dashi','昆布出汁','袋','JFC',2],
    [18,'板のり（JFC）','Nori Sheet (JFC)','海苔片（JFC）','袋','JFC',2],
    [19,'刻みのり','Shredded Nori','切碎海苔','袋','JFC',2],
    [20,'アイスクリーム','Ice Cream','冰淇淋','個','JFC',4],
    // Cherry
    [23,'メンマ','Menma (Bamboo)','笋干','袋','Cherry',2],
    [24,'紅生姜','Pickled Red Ginger','红姜','袋','Cherry',2],
    [25,'コーン','Corn','玉米','缶','Cherry',3],
    [26,'枝豆','Edamame','毛豆','袋','Cherry',2],
    [27,'フレンチフライ','French Fries','薯条','箱','Cherry',2],
    [28,'たこわさ','Octopus Wasabi','章鱼山葵','袋','Cherry',2],
    [29,'三温糖','Brown Sugar','三温糖','袋','Cherry',2],
    [30,'一味','Ichimi Chili','一味唐辛子','袋','Cherry',2],
    [31,'七味','Shichimi Spice','七味粉','袋','Cherry',2],
    [32,'輪切り唐辛子','Sliced Chili','圈切辣椒','袋','Cherry',2],
    [33,'わかめ','Wakame','裙带菜','袋','Cherry',2],
    [34,'キクラゲ','Wood Ear Mushroom','木耳','袋','Cherry',2],
    [35,'糸削り節','Shaved Bonito','细鲣鱼花','袋','Cherry',2],
    [36,'胡麻ドレ','Sesame Dressing','芝麻酱','本','Cherry',2],
    [37,'ごまペースト','Sesame Paste','芝麻酱（膏）','袋','Cherry',2],
    [38,'いりごま','Roasted Sesame','烤芝麻','袋','Cherry',2],
    [39,'すりごま','Ground Sesame','磨碎芝麻','袋','Cherry',2],
    [40,'合わせ味噌','Mixed Miso','混合味噌','袋','Cherry',2],
    [41,'赤味噌','Red Miso','红味噌','個','Cherry',2],
    [42,'おろし生姜','Grated Ginger','姜蓉','個','Cherry',3],
    [43,'ニンニクおろし','Grated Garlic','蒜蓉','個','Cherry',3],
    [44,'明太子チューブ','Mentaiko Tube','明太子酱管','個','Cherry',2],
    [45,'バター','Butter','黄油','箱','Cherry',2],
    [46,'お好みソース','Okonomiyaki Sauce','大阪烧酱','本','Cherry',2],
    [47,'豆板醤','Doubanjiang','豆瓣酱','個','Cherry',2],
    [48,'精製塩','Refined Salt','精制盐','袋','Cherry',2],
    [49,'ホワイトペッパー','White Pepper','白胡椒','缶','Cherry',2],
    [50,'昆布茶','Kombu Tea','昆布茶','袋','Cherry',2],
    [51,'ラー油','Chili Oil','辣椒油','本','Cherry',2],
    [52,'山椒','Sansho Pepper','花椒','袋','Cherry',2],
    [53,'カレーフレーク','Curry Flakes','咖喱片','袋','Cherry',2],
    [54,'柚子胡椒','Yuzu Kosho','柚子辣椒','個','Cherry',2],
    [55,'アサリ（Cherry）','Clams (Cherry)','蛤蜊（Cherry）','袋','Cherry',4],
    [56,'サラダ油','Vegetable Oil','沙拉油','本','Cherry',2],
    [57,'シャンタンベース','Shantan Base','香坛底料','個','Cherry',2],
    [58,'フライドオニオン','Fried Onion Flakes','洋葱酥','袋','Cherry',2],
    [59,'小麦粉','Flour','面粉','袋','Cherry',2],
    [60,'オニオンドレッシング','Onion Dressing','洋葱沙拉酱','本','Cherry',2],
    [61,'豚バラ串','Pork Belly Skewer','猪五花串','箱','Cherry',2],
    [62,'むき海老','Peeled Shrimp','去壳虾','袋','Cherry',2],
    [63,'板のり（Cherry）','Nori Sheet (Cherry)','海苔片（Cherry）','袋','Cherry',2],
    [64,'板のり 1/3','Nori Sheet 1/3','海苔片 1/3','袋','Cherry',2],
    [65,'椎茸 5LB','Shiitake 5LB','香菇 5LB','袋','Cherry',2],
    [66,'ゆかり','Yukari Shiso Powder','紫苏粉','袋','Cherry',2],
    // Wismettac
    [72,'ブラックガーリックオイル','Black Garlic Oil','黑蒜油','袋','Wismettac',2],
    [73,'お米','Rice','大米','袋','Wismettac',2],
    [74,'リッキー','Ricky (Drink Mix)','力奇饮料','箱','Wismettac',1],
    [75,'出汁パック','Dashi Pack','出汁包','袋','Wismettac',2],
    [77,'ゆずぽん','Yuzu Ponzu','柚子橙醋','本','Wismettac',2],
    [78,'酢','Vinegar','醋','箱','Wismettac',2],
    [79,'鶏油','Chicken Oil','鸡油','袋','Wismettac',2],
    // Kukui
    [80,'Pork Ground','Pork Ground','猪绞肉','LB','Kukui',20],
    [81,'Boneless Pork Butt','Boneless Pork Butt','去骨猪肩','LB','Kukui',10],
    [82,'Pork Belly 1.5mm','Pork Belly 1.5mm','猪五花 1.5mm','LB','Kukui',10],
    [83,'Pork Fat No Skin','Pork Fat No Skin','猪背脂','LB','Kukui',5],
    [84,'Boneless Chicken Thigh','Boneless Chicken Thigh','去骨鸡腿','LB','Kukui',10],
    [85,'Chicken Bone 10LB','Chicken Bone 10LB','鸡骨架 10LB','LB','Kukui',10],
    [86,'Chicken Paws','Chicken Paws','鸡爪','LB','Kukui',5],
    // Sun Noodle
    [87,'餃子の皮 (46x24)','Gyoza Wrapper (46x24)','饺子皮 (46x24)','CS','Sun Noodle',2],
    [88,'MI-24S 麺','MI-24S Noodle','MI-24S 面条','CS','Sun Noodle',2],
    [89,'MOCHI TSK-10S 麺','MOCHI TSK-10S Noodle','MOCHI TSK-10S 面条','CS','Sun Noodle',2],
    [90,'EZO-20W 麺','EZO-20W Noodle','EZO-20W 面条','CS','Sun Noodle',2],
    [91,'UF 醤油スープ','UF Shoyu Soup Base','UF 酱油汤底','CS','Sun Noodle',2],
    [92,'UF 豚骨スープ','UF Tonkotsu Soup Base','UF 猪骨汤底','CS','Sun Noodle',2],
    // Seven
    [93,'キャベツ','Cabbage','卷心菜','LBS','Seven',20],
    [94,'青ネギ','Green Onion','青葱','LBS','Seven',10],
    [95,'シシトウ','Shishito Pepper','狮子椒','LBS','Seven',5],
    [96,'もやし（5LB袋）','Bean Sprout (5LB)','豆芽（5LB）','BAG','Seven',4],
    [97,'ニラ','Chive','韭菜','LBS','Seven',5],
    [98,'きゅうり','Cucumber','黄瓜','LBS','Seven',5],
    [99,'大根','Daikon Radish','白萝卜','LBS','Seven',5],
    [100,'玉子（トレー）','Eggs (Tray)','鸡蛋（托盘）','TRAY','Seven',2],
    [101,'生姜','Ginger','生姜','LBS','Seven',5],
    [102,'グレープトマト','Grape Tomato','圣女果','LBS','Seven',3],
    [103,'レモン','Lemon','柠檬','LBS','Seven',5],
    [104,'玉ねぎ','Onion','洋葱','LBS','Seven',10],
    [105,'むきにんにく','Peeled Garlic','去皮大蒜','BAG','Seven',2],
    [106,'赤玉ねぎ','Red Onion','红洋葱','LBS','Seven',5],
    [107,'大葉','Shiso Leaf','紫苏叶','TRAY','Seven',2],
    [108,'ほうれん草','Spinach','菠菜','BAG','Seven',2],
    [109,'スプリングミックス','Spring Mix','春季沙拉菜','BAG','Seven',2],
    [110,'半熟玉子 W','Soft-Boiled Egg W','溏心蛋 W','個','Seven',20],
    [111,'温泉玉子','Onsen Egg','温泉蛋','個','Seven',20],
    [112,'チェリートマト','Cherry Tomato','小番茄','LBS','Seven',3],
    [113,'小ネギ 2-3mm','Green Onion 2-3mm','小葱 2-3mm','LBS','Seven',5],
    // サーバー（アルコール・ドリンク）
    [200,'餃子用ソース','Gyoza Sauce','饺子酱','本','サーバー棚卸し',2],
    [201,'餃子用マジックソルト','Magic Salt','魔法盐','本','サーバー棚卸し',2],
    [202,'餃子用ガーリックオイル','Garlic Oil','蒜油','本','サーバー棚卸し',2],
    [203,'サッポロビール','Sapporo Beer','札幌啤酒','樽','サーバー棚卸し',1],
    [204,'獺祭','Dassai Sake','獺祭清酒','本','サーバー棚卸し',2],
    [205,'久保田','Kubota Sake','久保田清酒','本','サーバー棚卸し',2],
    [206,'松竹梅','Shochikubai Sake','松竹梅清酒','本','サーバー棚卸し',2],
    [207,'八海山','Hakkaisan Sake','八海山清酒','本','サーバー棚卸し',2],
    [208,'Suntory Toki','Suntory Toki','三得利Toki','本','サーバー棚卸し',2],
    [209,'Jack Daniel','Jack Daniel','杰克丹尼','本','サーバー棚卸し',2],
    [210,'Evan','Evan Williams','埃文威廉姆斯','本','サーバー棚卸し',2],
    [211,'いいちこ','Iichiko Shochu','伊食楚焼酎','本','サーバー棚卸し',2],
    [212,'黒霧島','Kuro Kirishima','黑雾岛烧酎','本','サーバー棚卸し',2],
    [213,'梅酒','Umeshu','梅酒','本','サーバー棚卸し',2],
    [214,'ゆず酒','Yuzu Sake','柚子酒','本','サーバー棚卸し',2],
    [215,'赤ワイン','Red Wine','红葡萄酒','本','サーバー棚卸し',2],
    [216,'白ワイン','White Wine','白葡萄酒','本','サーバー棚卸し',2],
    [217,'シャンパン','Champagne','香槟','本','サーバー棚卸し',2],
    [218,'コーラ','Cola','可乐','本','サーバー棚卸し',6],
    [219,'ダイエットコーラ','Diet Cola','健怡可乐','本','サーバー棚卸し',6],
    [220,'スプライト','Sprite','雪碧','本','サーバー棚卸し',6],
    [221,'ダイヤモンドクリーム','Diamond Cream','钻石奶油苏打','本','サーバー棚卸し',4],
    [222,'お茶','Green Tea','绿茶','本','サーバー棚卸し',4],
    [223,'Hot お茶','Hot Tea','热绿茶','本','サーバー棚卸し',4],
    [224,'強炭酸','Sparkling Water','强碳酸水','本','サーバー棚卸し',4],
    [225,'ポッカレモン','Pokka Lemon','柠檬汁','本','サーバー棚卸し',4],
    [226,'パイナップルシロップ','Pineapple Syrup','菠萝糖浆','本','サーバー棚卸し',2],
    [227,'パッションフルーツシロップ','Passion Fruit Syrup','百香果糖浆','本','サーバー棚卸し',2],
    [228,'ピーチシロップ','Peach Syrup','桃糖浆','本','サーバー棚卸し',2],
    [229,'ライチシロップ','Lychee Syrup','荔枝糖浆','本','サーバー棚卸し',2],
    [230,'VODKA ボトル','Vodka Bottle','伏特加','本','サーバー棚卸し',2],
    // Sam's
    [400,'トリガラ','Chicken Carcass','鸡骨架','袋',"Sam's",2],
    [401,'オイスターソース','Oyster Sauce','蚝油','本',"Sam's",2],
    [402,'Ranch Dressing','Ranch Dressing','牧场沙拉酱','本',"Sam's",2],
    [403,'キムチの素','Kimchi Base','泡菜酱','袋',"Sam's",2],
    [404,'白だし','Shiro Dashi','白出汁','本',"Sam's",2],
    [405,'ケチャップ','Ketchup','番茄酱','本',"Sam's",2],
    [406,'ピーナツバター','Peanut Butter','花生酱','瓶',"Sam's",2],
    [407,'メープルシロップ','Maple Syrup','枫糖浆','本',"Sam's",2],
    [408,'黒みつ','Black Sugar Syrup','黑蜜','本',"Sam's",2],
    [409,'まっ茶','Matcha Powder','抹茶粉','袋',"Sam's",2],
    [410,'きな粉','Kinako (Soybean Powder)','黄豆粉','袋',"Sam's",2],
    [411,'青のり','Aonori (Green Seaweed)','青海苔','袋',"Sam's",2],
    [412,'ミックスナッツ','Mixed Nuts','混合坚果','袋',"Sam's",2],
    [413,'ピクルス','Pickles','泡菜','瓶',"Sam's",2],
    [414,'パン粉','Breadcrumbs','面包粉','袋',"Sam's",2],
    // キッチン備品 (Sam's)
    [415,'ZipLoc Sandwich','ZipLoc Sandwich','ZipLoc 三明治袋','箱',"Sam's",2],
    [416,'Ziploc Gallon','Ziploc Gallon','ZipLoc 加仑袋','箱',"Sam's",2],
    [417,'Paper Towel','Paper Towel','纸巾','袋',"Sam's",4],
    [418,'Plastic Food Wrap','Plastic Food Wrap','保鲜膜','本',"Sam's",2],
    [419,'Aluminum Wrap','Aluminum Wrap','铝箔纸','本',"Sam's",2],
    [420,'Rubber Gloves','Rubber Gloves','橡胶手套','箱',"Sam's",2],
    [421,'Wax Paper','Wax Paper','蜡纸','本',"Sam's",2],
    [422,'Red Pen','Red Pen','红笔','本',"Sam's",3],
    [423,'Label L','Label L (Large)','标签 L','袋',"Sam's",2],
    [424,'Label S','Label S (Small)','标签 S','袋',"Sam's",2],
    [425,'Blue Tape L','Blue Tape L (Large)','蓝色胶带 L','本',"Sam's",2],
    [426,'Blue Tape S','Blue Tape S (Small)','蓝色胶带 S','本',"Sam's",2],
    [427,'Rubber Band','Rubber Band','橡皮筋','袋',"Sam's",2],
    // 消耗品
    [300,'ロールペーパー（Handy）','Roll Paper (Handy)','卫生纸（手持）','本','消耗品',2],
    [301,'ロールペーパー（Station/Kitchen）','Roll Paper (Station)','卫生纸（台站）','本','消耗品',2],
    [302,'ボールペン','Ballpoint Pen','圆珠笔','本','消耗品',5],
    [303,'はさみ','Scissors','剪刀','本','消耗品',2],
    [304,'セロテープ','Tape','胶带','本','消耗品',2],
    [305,'赤ペン','Red Pen','红笔','本','消耗品',3],
    [306,'テイクアウト用丼','Takeout Bowl','外卖碗','個','消耗品',20],
    [307,'テイクアウト用中蓋','Takeout Mid Lid','外卖中盖','個','消耗品',20],
    [308,'テイクアウト用ふた','Takeout Lid','外卖盖','個','消耗品',20],
    [309,'テイクアウト用ビニール袋','Takeout Plastic Bag','外卖塑料袋','枚','消耗品',30],
    [310,'テイクアウト用餃子箱 大','Takeout Gyoza Box (L)','外卖饺子盒（大）','個','消耗品',20],
    [311,'テイクアウト用餃子箱 小','Takeout Gyoza Box (S)','外卖饺子盒（小）','個','消耗品',20],
    [312,'テイクアウト用ソースカップ','Takeout Sauce Cup','外卖酱料杯','個','消耗品',30],
    [313,'箸','Chopsticks','筷子','膳','消耗品',30],
    [314,'フォーク','Fork','叉子','本','消耗品',20],
    [315,'スプーン','Spoon','勺子','本','消耗品',20],
    [316,'ストロー','Straw','吸管','本','消耗品',30],
    [317,'ナプキン','Napkin','餐巾','枚','消耗品',50],
    [318,'ハンドペーパー','Hand Paper','擦手纸','枚','消耗品',50],
    [319,'タオル','Towel','毛巾','枚','消耗品',10],
    [320,'テーブル用洗剤','Table Cleaner','餐桌清洁剂','本','消耗品',2],
  ];

  for (const item of items) {
    await pool.query(
      `INSERT INTO items (id, name_ja, name_en, name_zh, unit, vendor, min_stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      item
    );
  }
  console.log('✅ Items seeded');
}

// ── Routes ───────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Translation endpoint (server-side to avoid CORS)
app.post('/api/translate', async (req, res) => {
  const { text, type } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  try {
    const prompt = type === 'category'
      ? `Translate this Japanese food/inventory category name into English and Simplified Chinese. Reply ONLY with JSON like: {"en":"...","zh":"..."}

Japanese: ${text}`
      : `Translate this Japanese food/inventory item name into English and Simplified Chinese. Reply ONLY with JSON like: {"en":"...","zh":"..."}

Japanese: ${text}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    const txt = data.content?.[0]?.text || '';
    const match = txt.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return res.json({ en: parsed.en || text, zh: parsed.zh || text });
    }
    res.json({ en: text, zh: text });
  } catch (e) {
    console.error('Translation error:', e.message);
    res.json({ en: text, zh: text });
  }
});

// ひらがな⇔カタカナ正規化
function normalizeKana(str) {
  if (!str) return '';
  // カタカナ→ひらがな
  return str.replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).toLowerCase();
}

// GET all items (active only by default, ?all=true for all, ?q= for search)
app.get('/api/items', async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const q = req.query.q ? req.query.q.trim() : '';

    if (q) {
      const norm = normalizeKana(q);
      // name_ja / name_en / vendor_item_name をひらがな正規化して部分一致
      const { rows } = await pool.query(`
        SELECT * FROM items
        WHERE active = true
        AND (
          LOWER(name_ja) LIKE $1
          OR LOWER(name_en) LIKE $1
          OR LOWER(vendor_item_name) LIKE $1
          OR LOWER(name_ja) LIKE $2
          OR LOWER(name_en) LIKE $2
        )
        ORDER BY category, id
        LIMIT 20
      `, [`%${norm}%`, `%${q.toLowerCase()}%`]);
      return res.json(rows);
    }

    const query = showAll
      ? 'SELECT * FROM items ORDER BY category, id'
      : 'SELECT * FROM items WHERE active=true ORDER BY category, id';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH item settings (name_ja / name_en / name_zh / unit / min_stock / category / active)
app.patch('/api/items/:id', async (req, res) => {
  const { name_ja, name_en, name_zh, unit, min_stock, category, active, vendor_item_name, vendor_item_code, order_item_name } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE items SET
        name_ja=COALESCE($1, name_ja),
        name_en=COALESCE($2, name_en),
        name_zh=COALESCE($3, name_zh),
        unit=$4, min_stock=$5, category=$6, active=$7,
        vendor_item_name=COALESCE($9, vendor_item_name),
        vendor_item_code=COALESCE($10, vendor_item_code),
        order_item_name=COALESCE($11, order_item_name)
       WHERE id=$8 RETURNING *`,
      [name_ja||null, name_en||null, name_zh||null, unit, min_stock, category || '調味料',
       active !== undefined ? active : true, req.params.id,
       vendor_item_name||null, vendor_item_code||null, order_item_name||null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST new item
app.post('/api/items', async (req, res) => {
  const { name_ja, name_en, name_zh, unit, vendor, min_stock, category } = req.body;
  try {
    const { rows: [maxRow] } = await pool.query('SELECT MAX(id) as max FROM items WHERE id < 200');
    const nextId = Math.max((maxRow.max || 0) + 1, 114);
    const { rows } = await pool.query(
      `INSERT INTO items (id, name_ja, name_en, name_zh, unit, vendor, min_stock, category, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *`,
      [nextId, name_ja, name_en || name_ja, name_zh || name_ja, unit, vendor || 'その他', min_stock || 2, category || '調味料']
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE item
app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST new session (complete inventory)
app.post('/api/sessions', async (req, res) => {
  const { date, month, time, staffName, location, vendorStamps, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [session] } = await client.query(
      'INSERT INTO sessions (date, month, time, staff_name, location) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [date, month, time, staffName, location || 'Piikoi']
    );

    // Insert session items
    for (const item of items) {
      await client.query(
        `INSERT INTO session_items (session_id, item_id, current_stock, staff_stamp, stamp_time)
         VALUES ($1,$2,$3,$4,$5)`,
        [session.id, item.id, item.current ?? null, item.staffStamp || null, item.stampTime || null]
      );
    }

    // Insert vendor stamps
    for (const [vendor, stamp] of Object.entries(vendorStamps || {})) {
      await client.query(
        'INSERT INTO vendor_stamps (session_id, vendor, staff, stamp_time) VALUES ($1,$2,$3,$4)',
        [session.id, vendor, stamp.staff, stamp.time]
      );
    }

    await client.query('COMMIT');
    res.json({ ...session, vendorStamps, items });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET sessions list (optional ?location= filter)
app.get('/api/sessions', async (req, res) => {
  try {
    const { location } = req.query;
    let query = 'SELECT * FROM sessions';
    const params = [];
    if (location) {
      query += ' WHERE location=$1';
      params.push(location);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single session with items + stamps
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const { rows: [session] } = await pool.query(
      'SELECT * FROM sessions WHERE id=$1', [req.params.id]
    );
    if (!session) return res.status(404).json({ error: 'Not found' });

    const { rows: items } = await pool.query(
      `SELECT si.*, i.name_ja, i.name_en, i.name_zh, i.unit, i.vendor, i.min_stock, i.category
       FROM session_items si JOIN items i ON si.item_id = i.id
       WHERE si.session_id = $1 ORDER BY i.category, i.id`,
      [req.params.id]
    );

    const { rows: stamps } = await pool.query(
      'SELECT * FROM vendor_stamps WHERE session_id=$1', [req.params.id]
    );

    const vendorStamps = {};
    stamps.forEach(s => { vendorStamps[s.vendor] = { staff: s.staff, time: s.stamp_time }; });

    res.json({ ...session, items, vendorStamps });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET categories
app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort_order, id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST category (add new) - accepts name_en, name_zh translations
app.post('/api/categories', async (req, res) => {
  const { name, name_en, name_zh, icon } = req.body;
  try {
    const { rows: [maxRow] } = await pool.query('SELECT MAX(sort_order) as max FROM categories');
    const nextOrder = (maxRow.max || 0) + 1;
    const { rows } = await pool.query(
      `INSERT INTO categories (name, name_en, name_zh, icon, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (name) DO UPDATE SET name_en=$2, name_zh=$3, icon=$4
       RETURNING *`,
      [name, name_en || name, name_zh || name, icon || 'ti-tag', nextOrder]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH category (update translations/icon)
app.patch('/api/categories/:name', async (req, res) => {
  const { name_en, name_zh, icon } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE categories SET
        name_en=COALESCE($1, name_en),
        name_zh=COALESCE($2, name_zh),
        icon=COALESCE($3, icon)
       WHERE name=$4 RETURNING *`,
      [name_en||null, name_zh||null, icon||null, decodeURIComponent(req.params.name)]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE category
app.delete('/api/categories/:name', async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE name=$1', [decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET/SET admin email setting
app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM settings');
    const result = {};
    rows.forEach(r => result[r.key] = r.value);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
      [key, value]
    );
    res.json({ key, value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Seed categories ─────────────────────────────────
async function seedCategories() {
  const categoryMap = {
    '肉・海鮮': [80,81,82,83,84,85,86,61,62,12,13,55],
    '野菜・卵': [93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113],
    '麺・米': [87,88,89,90,91,92,73],
    '調味料': [1,2,3,5,6,9,10,15,17,29,36,37,38,39,40,41,42,43,44,46,47,48,49,50,51,52,53,54,56,57,60,72,75,77,78,79],
    '乾物・ストック': [4,7,8,16,18,19,23,24,25,26,28,30,31,32,33,34,35,58,59,63,64,65,66],
    '冷凍・その他': [11,14,20,27,74],
    'サーバー': [200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230],
    '消耗品': [300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320],
    '調味料': [400,401,402,403,404,405,406,407,408,409,410,411],
    '乾物・ストック': [412,413,414],
    'キッチン備品': [415,416,417,418,419,420,421,422,423,424,425,426,427],
  };

  // Only set category if still at default value '調味料'
  // This preserves any manual changes made via the settings tab
  for (const [category, ids] of Object.entries(categoryMap)) {
    for (const id of ids) {
      await pool.query(
        `UPDATE items SET category=$1 WHERE id=$2 AND category='調味料'`,
        [category, id]
      );
    }
  }

  // Delete old server/consumable items that no longer exist
  const validIds = Object.values(categoryMap).flat();
  const validServerIds = validIds.filter(id=>id>=200);
  if (validServerIds.length > 0) {
    await pool.query(
      `DELETE FROM items WHERE id >= 200 AND id NOT IN (${validServerIds.join(',')})`
    );
  }

  console.log('✅ Categories seeded (manual overrides preserved)');
}

// ── Start ─────────────────────────────────────────────


// ── Receipt AI Analysis ───────────────────────────────
app.post('/api/analyze-receipt', async (req, res) => {
  try {
    const { image, mediaType } = req.body;
    if (!image) return res.status(400).json({ error: 'image required' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `この納品伝票・請求書・配達票・インボイスを詳細に読み取り、以下のJSON形式で返してください。JSONのみ返してください。マークダウンコードブロック不要です。会社名・ベンダー名・送り主名・税額・合計金額を必ず読み取ってください。

{
  "invoice_no": "請求書番号・インボイス番号（必ず読み取る）",
  "vendor": "業者名・会社名（必ず読み取る）",
  "delivered_date": "YYYY-MM-DD形式（不明な場合は今日の日付）",
  "subtotal": 小計金額（数値、不明はnull）,
  "tax_amount": 税額合計（数値、複数税率がある場合は合算する、不明はnull）,
  "total": 合計金額（数値、不明はnull）,
  "items": [
    {
      "item_name": "品名",
      "item_code": "品番（なければ空文字）",
      "unit_price": 数値（不明はnull）,
      "quantity": 数値（不明はnull）,
      "note": "備考（なければ空文字）"
    }
  ]
}

今日の日付: ${new Date().toISOString().slice(0,10)}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// ── Send Order Email with PDF ─────────────────────────
app.post('/api/orders/:id/send', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, 
       TO_CHAR(o.order_date, 'YYYY-MM-DD') as order_date,
       TO_CHAR(o.delivery_date, 'YYYY-MM-DD') as delivery_date,
       json_agg(json_build_object('item_name',oi.item_name,'unit',oi.unit,'quantity',oi.quantity,'note',oi.note) ORDER BY oi.id) as items
       FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id WHERE o.id=$1 GROUP BY o.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const order = rows[0];
    const { to, cc, test_mode } = req.body;

    // PDF生成
    const pdfBuffer = await generateOrderPDF(order);

    // メール本文（HTML）
    const itemRows = (order.items||[]).filter(it=>it.item_name).map(it => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${it.item_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${it.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600;color:#D85A30;">${it.quantity}</td>
      </tr>`).join('');

    const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#2C3E50;padding:20px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:20px;">TANTO Gyoza & Ramen Bar</h1>
        <p style="color:#aaa;margin:5px 0 0;font-size:13px;">Purchase Order</p>
      </div>
      <div style="padding:24px;background:#f9f9f9;">
        <table style="width:100%;margin-bottom:16px;">
          <tr><td style="color:#666;font-size:13px;">PO Number</td><td style="font-weight:600;">${order.po_number}</td></tr>
          <tr><td style="color:#666;font-size:13px;">Vendor</td><td style="font-weight:600;">${order.vendor}</td></tr>
          <tr><td style="color:#666;font-size:13px;">Order Date</td><td>${(order.order_date||'').slice(0,10)}</td></tr>
          ${order.delivery_date ? `<tr><td style="color:#666;font-size:13px;">Delivery Date</td><td>${(order.delivery_date||'').slice(0,10)}</td></tr>` : ''}
          ${order.person ? `<tr><td style="color:#666;font-size:13px;">Person</td><td>${order.person}</td></tr>` : ''}
          ${order.memo ? `<tr><td style="color:#666;font-size:13px;">Memo</td><td>${order.memo}</td></tr>` : ''}
        </table>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#34495E;color:white;">
              <th style="padding:10px 12px;text-align:left;font-size:13px;">Item</th>
              <th style="padding:10px 12px;text-align:center;font-size:13px;">Unit</th>
              <th style="padding:10px 12px;text-align:center;font-size:13px;">Qty</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
      <div style="padding:16px 24px;background:#f0f0f0;text-align:center;font-size:12px;color:#666;">
        TANTO Gyoza & Ramen Bar | 1232 Waimanu St STE105, Honolulu, HI 96814 | Tel: 808-888-0292
      </div>
    </div>`;

    const toAddress = test_mode ? process.env.TEST_EMAIL || 'sales@tanto-otabe.com' : to;
    const subject = test_mode
      ? `[TEST] TANTO Order - ${order.vendor} - ${(order.order_date||'').slice(0,10)}`
      : `TANTO Order - ${order.vendor} - ${(order.order_date||'').slice(0,10)}`;

    const emailPayload = {
      from: `TANTO Order (No Reply) <${process.env.MAIL_FROM || 'noreply@medigreen.energy'}>`,
      to: toAddress.split(',').map(e => e.trim()).filter(Boolean),
      subject,
      html: htmlBody,
      attachments: [{
        filename: `${order.po_number}.pdf`,
        content: pdfBuffer.toString('base64'),
      }],
    };
    if (!test_mode && cc) emailPayload.cc = cc.split(',').map(e=>e.trim());

    const result = await resend.emails.send(emailPayload);
    res.json({ ok: true, email_id: result.id, po_number: order.po_number });
  } catch (e) {
    console.error('Send order error:', e);
    res.status(500).json({ error: e.message });
  }
});

async function generateOrderPDF(order) {
  return new Promise((resolve, reject) => {
    const path = require('path');
    const fontPath = path.join(__dirname, 'fonts', 'NotoSansCJKjp-Regular.otf');
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    doc.registerFont('NotoSans', fontPath);
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ヘッダー
    doc.rect(0, 0, doc.page.width, 80).fill('#2C3E50');
    doc.fillColor('white').fontSize(22).font('NotoSans')
       .text('TANTO Gyoza & Ramen Bar', 50, 20);
    doc.fontSize(12).font('NotoSans')
       .text('PURCHASE ORDER', 50, 50);

    // 発注情報
    doc.fillColor('#333').fontSize(11).font('NotoSans');
    doc.text('ORDER INFORMATION', 50, 100);
    doc.moveTo(50, 115).lineTo(doc.page.width - 50, 115).stroke('#ccc');

    const info = [
      ['PO Number:', order.po_number],
      ['Vendor:', order.vendor],
      ['Order Date:', (order.order_date||'').slice(0,10)],
      ['Delivery Date:', (order.delivery_date||'').slice(0,10) || '-'],
      ['Person:', order.person || '-'],
    ];
    if (order.memo) info.push(['Memo:', order.memo]);

    let y = 125;
    info.forEach(([label, value]) => {
      doc.font('NotoSans').fillColor('#666').fontSize(10).text(label, 50, y);
      doc.font('NotoSans').fillColor('#333').text(value, 180, y);
      y += 18;
    });

    // 品目テーブル
    y += 10;
    doc.font('NotoSans').fontSize(11).fillColor('#333')
       .text('ORDER ITEMS', 50, y);
    y += 15;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#ccc');
    y += 5;

    // テーブルヘッダー
    doc.rect(50, y, doc.page.width - 100, 22).fill('#34495E');
    doc.fillColor('white').font('NotoSans').fontSize(10);
    doc.text('Item', 60, y + 6);
    doc.text('Unit', doc.page.width - 180, y + 6);
    doc.text('Qty', doc.page.width - 100, y + 6);
    y += 22;

    // テーブル行
    const items = (order.items||[]).filter(it=>it.item_name);
    items.forEach((it, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f5f5f5';
      doc.rect(50, y, doc.page.width - 100, 20).fill(bg);
      doc.fillColor('#333').font('NotoSans').fontSize(10);
      doc.text(it.item_name, 60, y + 5, { width: doc.page.width - 280 });
      doc.text(it.unit, doc.page.width - 180, y + 5);
      doc.fillColor('#D85A30').font('NotoSans').text(String(it.quantity), doc.page.width - 100, y + 5);
      y += 20;
    });

    // フッター
    doc.moveTo(50, y + 10).lineTo(doc.page.width - 50, y + 10).stroke('#ccc');
    doc.fillColor('#666').font('NotoSans').fontSize(9)
       .text('TANTO Gyoza & Ramen Bar | 1232 Waimanu St STE105, Honolulu, HI 96814 | Tel: 808-888-0292',
         50, y + 18, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  });
}

// ── Orders API ────────────────────────────────────────

// PO番号自動採番
async function generatePONumber(location) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
  const prefix = location === 'University' ? 'UNIVERSITY' : 'ALAMOANA';
  const { rows } = await pool.query(
    `SELECT po_number FROM orders WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1`,
    [`${prefix}-${ym}-%`]
  );
  const seq = rows.length > 0
    ? String(parseInt(rows[0].po_number.split('-')[2]) + 1).padStart(4, '0')
    : '0001';
  return `${prefix}-${ym}-${seq}`;
}

// GET /api/orders
app.get('/api/orders', async (req, res) => {
  try {
    const { vendor, from, to } = req.query;
    let sql = `SELECT o.*, json_agg(json_build_object('id',oi.id,'item_name',oi.item_name,'unit',oi.unit,'quantity',oi.quantity,'note',oi.note) ORDER BY oi.id) as items
               FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id`;
    const conds = [], params = [];
    if (vendor) { params.push(vendor); conds.push(`o.vendor=$${params.length}`); }
    if (from)   { params.push(from);   conds.push(`o.order_date>=$${params.length}`); }
    if (to)     { params.push(to);     conds.push(`o.order_date<=$${params.length}`); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/orders/:id
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, json_agg(json_build_object('id',oi.id,'item_name',oi.item_name,'unit',oi.unit,'quantity',oi.quantity,'note',oi.note) ORDER BY oi.id) as items
       FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id WHERE o.id=$1 GROUP BY o.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/orders
app.post('/api/orders', async (req, res) => {
  try {
    const { vendor, order_date, delivery_date, person, memo, items, location } = req.body;
    const po_number = await generatePONumber(location);
    const { rows } = await pool.query(
      `INSERT INTO orders (po_number, vendor, location, order_date, delivery_date, person, memo, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'sent') RETURNING *`,
      [po_number, vendor, location||'Piikoi', order_date, delivery_date||null, person||'', memo||'']
    );
    const order = rows[0];
    for (const it of (items||[])) {
      await pool.query(
        `INSERT INTO order_items (order_id, item_name, unit, quantity, note) VALUES ($1,$2,$3,$4,$5)`,
        [order.id, it.item_name, it.unit||'', it.quantity, it.note||'']
      );
    }
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/orders/:id
app.delete('/api/orders/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});





// ── Current Stock API ─────────────────────────────────
// 現在庫 = 最後の棚卸し数 + 突合済み納品数
app.get('/api/stock', async (req, res) => {
  try {
    const { location } = req.query;

    // 最新セッションを取得
    const sessionQuery = location
      ? `SELECT id, date FROM sessions WHERE location=$1 ORDER BY created_at DESC LIMIT 1`
      : `SELECT id, date FROM sessions ORDER BY created_at DESC LIMIT 1`;
    const sessionParams = location ? [location] : [];
    const { rows: sessions } = await pool.query(sessionQuery, sessionParams);
    const latestSession = sessions[0];

    // 全アクティブアイテムを取得
    const { rows: items } = await pool.query(
      `SELECT id, name_ja, name_en, unit, min_stock, vendor, category, vendor_item_name, vendor_item_code
       FROM items WHERE active = true ORDER BY category, vendor, name_ja`
    );

    if (!latestSession) {
      return res.json(items.map(i => ({...i, current_stock: 0, last_stock: 0, delivered_since: 0, last_session_date: null})));
    }

    // アイテムごとに最新のsession_itemsを取得（複数セッションに分けて棚卸しした場合に対応）
    const locationCond = location ? `AND s.location = $1` : '';
    const stockParams = location ? [location] : [];
    const { rows: sessionItems } = await pool.query(`
      SELECT DISTINCT ON (si.item_id) si.item_id, si.current_stock
      FROM session_items si
      JOIN sessions s ON s.id = si.session_id
      WHERE 1=1 ${locationCond}
      ORDER BY si.item_id, s.created_at DESC
    `, stockParams);
    const stockMap = {};
    sessionItems.forEach(si => { stockMap[si.item_id] = parseFloat(si.current_stock) || 0; });

    // 棚卸し後の納品を取得（突合済みのみ）
    const deliveryQuery = location
      ? `SELECT item_name, item_code, SUM(quantity) as qty FROM deliveries WHERE delivered_date >= $1 AND location=$2 GROUP BY item_name, item_code`
      : `SELECT item_name, item_code, SUM(quantity) as qty FROM deliveries WHERE delivered_date >= $1 GROUP BY item_name, item_code`;
    const deliveryParams = location ? [latestSession.date, location] : [latestSession.date];
    const { rows: deliveries } = await pool.query(deliveryQuery, deliveryParams);

    // アイテムごとに現在庫を計算
    const result = items.map(item => {
      const lastStock = stockMap[item.id] || 0;
      const delivery = deliveries.find(d =>
        (item.vendor_item_name && d.item_name && d.item_name.toLowerCase() === item.vendor_item_name.toLowerCase()) ||
        (item.vendor_item_code && d.item_code && d.item_code.toLowerCase() === item.vendor_item_code.toLowerCase())
      );
      const deliveredSince = delivery ? parseFloat(delivery.qty) || 0 : 0;
      return {
        ...item,
        last_stock: lastStock,
        delivered_since: deliveredSince,
        current_stock: lastStock + deliveredSince,
        last_session_date: latestSession.date,
      };
    });

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Debug Stock API ──────────────────────────────────
app.get('/api/debug/stock', async (req, res) => {
  try {
    const { location } = req.query;
    // 最新セッション確認
    const sessionQ = location
      ? `SELECT id, date, location, created_at FROM sessions WHERE location=$1 ORDER BY created_at DESC LIMIT 3`
      : `SELECT id, date, location, created_at FROM sessions ORDER BY created_at DESC LIMIT 3`;
    const { rows: sessions } = await pool.query(sessionQ, location ? [location] : []);

    // 最新セッションのsession_items確認
    let sessionItems = [];
    if (sessions[0]) {
      const { rows } = await pool.query(
        `SELECT si.item_id, si.current_stock, i.name_ja FROM session_items si JOIN items i ON i.id=si.item_id WHERE si.session_id=$1 LIMIT 10`,
        [sessions[0].id]
      );
      sessionItems = rows;
    }

    res.json({ sessions, sessionItems });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LINE通知 ──────────────────────────────────────────
async function sendLineMessage(message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;
  if (!token || !userId) { console.log('LINE not configured'); return; }
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] })
    });
    const data = await r.json();
    console.log('LINE sent:', data.message || 'OK');
  } catch(err) {
    console.error('LINE error:', err.message);
  }
}

// ── 棚卸し後の発注アラートLINE送信 ──────────────────
app.post('/api/sessions/:id/notify', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // セッション情報取得
    const { rows: [session] } = await pool.query(
      'SELECT * FROM sessions WHERE id=$1', [sessionId]
    );
    if (!session) return res.status(404).json({ error: 'not found' });

    // 発注必要アイテムを取得
    const { rows: items } = await pool.query(`
      SELECT si.current_stock, i.name_ja, i.min_stock, i.vendor, i.unit
      FROM session_items si
      JOIN items i ON si.item_id = i.id
      WHERE si.session_id = $1
      AND i.active = true
      AND i.min_stock > 0
      AND (i.min_stock - COALESCE(si.current_stock, 0)) > 0
      ORDER BY i.vendor, i.name_ja
    `, [sessionId]);

    if (items.length === 0) {
      await sendLineMessage(`✅ 棚卸し完了 - ${session.location}店\n発注が必要なアイテムはありません！`);
      return res.json({ ok: true, message: '発注不要' });
    }

    // 業者別にグループ化
    const vendorMap = {};
    items.forEach(it => {
      const v = it.vendor || 'その他';
      if (!vendorMap[v]) vendorMap[v] = [];
      const shortage = it.min_stock - (it.current_stock || 0);
      vendorMap[v].push(`・${it.name_ja}: ${shortage}${it.unit}不足（現${it.current_stock || 0}/${it.min_stock}）`);
    });

    // LINEメッセージ作成
    let msg = `📦 発注アラート - ${session.location}店\n`;
    msg += `棚卸し: ${session.date} ${session.time}\n`;
    msg += `${'─'.repeat(20)}\n`;
    Object.entries(vendorMap).forEach(([vendor, list]) => {
      msg += `\n【${vendor}】\n${list.join('\n')}\n`;
    });
    msg += `\n${'─'.repeat(20)}\n合計 ${items.length}品目の発注が必要です`;

    await sendLineMessage(msg);
    res.json({ ok: true, count: items.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Auto Matching API ─────────────────────────────────
// 納品品名から棚卸しアイテムの候補を返す
app.post('/api/deliveries/match', async (req, res) => {
  try {
    const { item_name, item_code } = req.body;
    if (!item_name) return res.json([]);

    // 既存の突合情報から完全一致を探す
    const { rows: exact } = await pool.query(`
      SELECT id, name_ja, name_en, vendor, vendor_item_name, vendor_item_code, order_item_name
      FROM items WHERE active = true
      AND (
        LOWER(vendor_item_name) = LOWER($1)
        OR LOWER(vendor_item_code) = LOWER($2)
      )
      LIMIT 3
    `, [item_name, item_code || '']);

    if (exact.length > 0) return res.json({ matched: true, items: exact });

    // 部分一致で候補を探す（日本語ファジー検索対応）
    // ひらがな⇔カタカナ正規化
    const normalizeStr = (str) => {
      if (!str) return '';
      return str.replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).toLowerCase();
    };

    // 英単語分割 + 日本語は2文字以上のサブストリングで検索
    const normName = normalizeStr(item_name);
    const enWords = item_name.toLowerCase().split(/[\s_\-\/]+/).filter(w => w.length > 2);

    // 検索条件を構築（英語単語 + 正規化済み全体 + 元の文字列）
    const searchTerms = [...new Set([
      normName,           // ひらがな正規化
      item_name.toLowerCase(), // 元の文字列
      ...enWords,         // 英語単語分割
    ])].filter(w => w.length > 1);

    if (searchTerms.length === 0) return res.json({ matched: false, items: [] });

    const conditions = searchTerms.map((w, i) =>
      `(LOWER(name_ja) LIKE $${i+1} OR LOWER(name_en) LIKE $${i+1} OR LOWER(vendor_item_name) LIKE $${i+1} OR LOWER(name_ja) LIKE $${i+1})`
    ).join(' OR ');
    const params = searchTerms.map(w => `%${w}%`);

    const { rows: partial } = await pool.query(`
      SELECT id, name_ja, name_en, vendor, vendor_item_name, vendor_item_code, order_item_name
      FROM items WHERE active = true
      AND (${conditions})
      LIMIT 8
    `, params);

    res.json({ matched: false, items: partial });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 突合情報を一括保存
app.post('/api/items/match-bulk', async (req, res) => {
  try {
    const { matches } = req.body; // [{ item_id, vendor_item_name, vendor_item_code }]
    const updated = [];
    for (const m of matches) {
      const { rows } = await pool.query(`
        UPDATE items SET vendor_item_name=$1, vendor_item_code=$2
        WHERE id=$3 RETURNING id, name_ja, vendor_item_name, vendor_item_code
      `, [m.vendor_item_name, m.vendor_item_code || '', m.item_id]);
      if (rows.length) updated.push(rows[0]);
    }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Apply Delivery to Stock ───────────────────────────
// 納品データを棚卸し在庫に反映
async function applyDeliveryToStock(delivery, location) {
  try {
    // 突合情報でアイテムを特定
    const { rows: matchedItems } = await pool.query(`
      SELECT id, name_ja FROM items 
      WHERE active = true
      AND (
        (vendor_item_name != '' AND LOWER(vendor_item_name) = LOWER($1))
        OR (vendor_item_code != '' AND LOWER(vendor_item_code) = LOWER($2))
      )
      LIMIT 1
    `, [delivery.item_name || '', delivery.item_code || '']);

    if (matchedItems.length === 0) return null; // 突合なし

    const itemId = matchedItems[0].id;
    const qty = parseFloat(delivery.quantity) || 0;
    if (qty <= 0) return null;

    // 最新の棚卸しセッションを取得
    const { rows: sessions } = await pool.query(`
      SELECT id FROM sessions 
      WHERE location = $1
      ORDER BY created_at DESC LIMIT 1
    `, [location || 'Piikoi']);

    if (sessions.length === 0) return null;

    const sessionId = sessions[0].id;

    // session_itemsのcurrent_stockに加算
    const { rows: existing } = await pool.query(`
      SELECT id, current_stock FROM session_items
      WHERE session_id = $1 AND item_id = $2
    `, [sessionId, itemId]);

    if (existing.length > 0) {
      const newStock = (existing[0].current_stock || 0) + qty;
      await pool.query(`
        UPDATE session_items SET current_stock = $1
        WHERE session_id = $2 AND item_id = $3
      `, [newStock, sessionId, itemId]);
    } else {
      await pool.query(`
        INSERT INTO session_items (session_id, item_id, current_stock)
        VALUES ($1, $2, $3)
      `, [sessionId, itemId, qty]);
    }

    return { item_id: itemId, item_name: matchedItems[0].name_ja, qty_added: qty };
  } catch (e) {
    console.error('applyDeliveryToStock error:', e);
    return null;
  }
}

// ── Deliveries API ────────────────────────────────────
app.get(`/api/deliveries`, async (req, res) => {
  try {
    const { vendor, from, to, invoice_no, location } = req.query;
    let sql = `SELECT * FROM deliveries`;
    const params = [];
    const conds = [];
    if (vendor)     { params.push(vendor);     conds.push(`vendor=$${params.length}`); }
    if (from)       { params.push(from);       conds.push(`delivered_date>=$${params.length}`); }
    if (to)         { params.push(to);         conds.push(`delivered_date<=$${params.length}`); }
    if (invoice_no) { params.push(invoice_no); conds.push(`invoice_no=$${params.length}`); }
    if (location)   { params.push(location);   conds.push(`location=$${params.length}`); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(`/api/deliveries`, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const inserted = [];
    for (const it of items) {
      const { rows } = await pool.query(
        `INSERT INTO deliveries (vendor,item_name,item_code,unit_price,quantity,delivered_date,note,image_url,tax_amount,subtotal,total,invoice_no,location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [it.vendor||'',it.item_name||'',it.item_code||'',it.unit_price??null,it.quantity??null,it.delivered_date||new Date().toISOString().slice(0,10),it.note||'',it.image_url||'',it.tax_amount??0,it.subtotal??0,it.total??0,it.invoice_no||'',it.location||'Piikoi']
      );
      inserted.push(rows[0]);

      // 突合情報があれば在庫に自動反映
      const applied = await applyDeliveryToStock(it, it.location || 'Piikoi');
      if (applied) {
        console.log(`✅ 在庫反映: ${applied.item_name} +${applied.qty_added}`);
      }
    }
    res.json(inserted);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch(`/api/deliveries/:id`, async (req, res) => {
  try {
    const { vendor,item_name,item_code,unit_price,quantity,delivered_date,note,tax_amount,subtotal,total } = req.body;
    // 既存データを取得してから更新（部分更新対応）
    const { rows: existing } = await pool.query('SELECT * FROM deliveries WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'not found' });
    const cur = existing[0];
    const { rows } = await pool.query(
      `UPDATE deliveries SET vendor=$1,item_name=$2,item_code=$3,unit_price=$4,quantity=$5,delivered_date=$6,note=$7,tax_amount=$8,subtotal=$9,total=$10 WHERE id=$11 RETURNING *`,
      [
        vendor ?? cur.vendor,
        item_name ?? cur.item_name,
        item_code ?? cur.item_code,
        unit_price ?? cur.unit_price,
        quantity ?? cur.quantity,
        delivered_date ?? cur.delivered_date,
        note ?? cur.note,
        tax_amount ?? cur.tax_amount ?? 0,
        subtotal ?? cur.subtotal ?? 0,
        total ?? cur.total ?? 0,
        req.params.id
      ]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(`/api/deliveries/:id`, async (req, res) => {
  try {
    await pool.query('DELETE FROM deliveries WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initDB();
  try {
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS vendor_item_name TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS vendor_item_code TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS order_item_name TEXT DEFAULT ''`);
    console.log('✅ items columns ensured');
  } catch(e) { console.log('items columns:', e.message); }
  await seedItems();
  await seedCategories();
});

// ── Deliveries ────────────────────────────────────────
// (inserted before listen — table created in initDB below)
