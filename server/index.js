require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// ── DB ──────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Middleware ───────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

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
      category TEXT NOT NULL DEFAULT '調味料'
    );

    -- Add category column if it doesn't exist (for existing DBs)
    DO $$ BEGIN
      ALTER TABLE items ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '調味料';
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
  `);
  console.log('✅ DB tables ready');
}

// ── Seed items if empty ──────────────────────────────
async function seedItems() {
  const { rows } = await pool.query('SELECT COUNT(*) FROM items');
  if (parseInt(rows[0].count) > 0) return;

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
    // サーバー棚卸し
    [200,'サッポロビール','Sapporo Beer (Keg)','札幌啤酒（桶）','樽','サーバー棚卸し',1],
    [201,'獺祭','Dassai Sake','獺祭清酒','本','サーバー棚卸し',2],
    [202,'いいちこ','Iichiko Shochu','伊食楚焼酎','本','サーバー棚卸し',2],
    [203,'八海山','Hakkaisan Sake','八海山清酒','本','サーバー棚卸し',2],
    [204,'久保田','Kubota Sake','久保田清酒','本','サーバー棚卸し',2],
    [205,'抹茶ビール','Matcha Beer','抹茶啤酒','箱','サーバー棚卸し',1],
    [206,'松竹梅 超辛','Shochikubai Super Dry','松竹梅超辛','6本','サーバー棚卸し',2],
    [207,'黒霧島','Kuro Kirishima Shochu','黑雾岛烧酎','本','サーバー棚卸し',2],
    [208,'コカコーラ','Coca-Cola','可口可乐','本','サーバー棚卸し',6],
    [209,'ダイエットコーラ','Diet Cola','健怡可乐','本','サーバー棚卸し',6],
    [210,'スプライト','Sprite','雪碧','本','サーバー棚卸し',6],
    [211,'Diamondhead Soda','Diamondhead Soda','Diamondhead 苏打','本','サーバー棚卸し',4],
    [212,'お茶','Tea','绿茶','本','サーバー棚卸し',4],
  ];

  for (const item of items) {
    await pool.query(
      `INSERT INTO items (id, name_ja, name_en, name_zh, unit, vendor, min_stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      item
    );
  }
  console.log('✅ Items seeded');
}

// ── Routes ───────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// GET all items
app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY vendor, id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH item settings (unit / min_stock / category)
app.patch('/api/items/:id', async (req, res) => {
  const { unit, min_stock, category } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE items SET unit=$1, min_stock=$2, category=$3 WHERE id=$4 RETURNING *',
      [unit, min_stock, category || '調味料', req.params.id]
    );
    res.json(rows[0]);
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
      `SELECT si.*, i.name_ja, i.name_en, i.name_zh, i.unit, i.vendor, i.min_stock
       FROM session_items si JOIN items i ON si.item_id = i.id
       WHERE si.session_id = $1 ORDER BY i.vendor, i.id`,
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
    // 肉・海鮮
    '肉・海鮮': [80,81,82,83,84,85,86,61,62,12,13,55],
    // 野菜・卵
    '野菜・卵': [93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113],
    // 麺・米
    '麺・米': [87,88,89,90,91,92,73],
    // 調味料
    '調味料': [1,2,3,5,6,9,10,15,17,29,36,37,38,39,40,41,42,43,44,46,47,48,49,50,51,52,53,54,56,57,60,72,75,77,78,79],
    // 乾物・ストック
    '乾物・ストック': [4,7,8,16,18,19,23,24,25,26,28,30,31,32,33,34,35,58,59,63,64,65,66],
    // 冷凍・その他
    '冷凍・その他': [11,14,20,27,74],
    // サーバー
    'サーバー': [200,201,202,203,204,205,206,207,208,209,210,211,212],
  };

  for (const [category, ids] of Object.entries(categoryMap)) {
    for (const id of ids) {
      await pool.query(
        'UPDATE items SET category=$1 WHERE id=$2',
        [category, id]
      );
    }
  }
  console.log('✅ Categories seeded');
}

// ── Start ─────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initDB();
  await seedItems();
  await seedCategories();
});
