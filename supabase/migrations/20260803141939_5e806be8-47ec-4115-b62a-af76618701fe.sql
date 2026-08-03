insert into public.categories (id,name_en,name_bn) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Fruits','ফল'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Meat & Fish','মাছ ও মাংস'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Tea & Coffee','চা ও কফি'),
('ffffffff-ffff-4fff-8fff-ffffffffffff','Health Care','স্বাস্থ্য সুরক্ষা'),
('12121212-1212-4121-8121-121212121212','Pet Care','পোষা প্রাণীর যত্ন')
on conflict (id) do nothing;

insert into public.products (category_id,name_en,name_bn,sku,price,cost,stock,unit,brand,pack_size,image_url) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Himsagar Mango 1kg','হিমসাগর আম ১ কেজি','SKU-6001',180,150,60,'kg','Local','1 kg','/products/mango-1kg.jpg'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Orange 1kg','কমলা ১ কেজি','SKU-6002',320,270,50,'kg','Imported','1 kg','/products/orange-1kg.jpg'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Green Grapes 500g','সবুজ আঙুর ৫০০ গ্রাম','SKU-6003',210,175,40,'pcs','Imported','500 g','/products/grapes-500g.jpg'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Ripe Papaya 1pc','পাকা পেঁপে ১টি','SKU-6004',95,72,45,'pcs','Local','1 pc','/products/papaya-1pc.jpg'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Rui Fish Cut 1kg','রুই মাছ কাটা ১ কেজি','SKU-6011',420,360,30,'kg','Fresh','1 kg','/products/rui-fish-1kg.jpg'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Hilsa Fish 1kg','ইলিশ মাছ ১ কেজি','SKU-6012',1650,1450,15,'kg','Padma','1 kg','/products/hilsa-1kg.jpg'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Mutton 1kg','খাসির মাংস ১ কেজি','SKU-6013',1150,1000,20,'kg','Fresh','1 kg','/products/mutton-1kg.jpg'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Shrimp 500g','চিংড়ি ৫০০ গ্রাম','SKU-6014',560,480,25,'pcs','Fresh','500 g','/products/shrimp-500g.jpg'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Instant Coffee 100g','ইনস্ট্যান্ট কফি ১০০ গ্রাম','SKU-6021',560,480,40,'pcs','Nescafe','100 g','/products/instant-coffee-100g.jpg'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Coffee Creamer 400g','কফি ক্রিমার ৪০০ গ্রাম','SKU-6022',450,385,35,'pcs','Coffee Mate','400 g','/products/coffee-creamer-400g.jpg'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Masala Tea 200g','মসলা চা ২০০ গ্রাম','SKU-6023',260,215,45,'pcs','Tetley','200 g','/products/masala-tea-200g.jpg'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Coffee Sachet 20pcs','কফি স্যাশে ২০ পিস','SKU-6024',240,200,50,'pcs','Nescafe','20 pcs','/products/coffee-sachet-20pcs.jpg'),
('ffffffff-ffff-4fff-8fff-ffffffffffff','Hand Sanitizer 250ml','হ্যান্ড স্যানিটাইজার ২৫০ মিলি','SKU-6031',180,145,60,'pcs','Savlon','250 ml','/products/hand-sanitizer-250ml.jpg'),
('ffffffff-ffff-4fff-8fff-ffffffffffff','Surgical Face Mask 50pcs','সার্জিক্যাল মাস্ক ৫০ পিস','SKU-6032',250,190,70,'pcs','Getwell','50 pcs','/products/face-mask-50pcs.jpg'),
('ffffffff-ffff-4fff-8fff-ffffffffffff','Vitamin C Tablet 30pcs','ভিটামিন সি ট্যাবলেট ৩০ পিস','SKU-6033',320,265,40,'pcs','Square','30 pcs','/products/vitamin-c-30pcs.jpg'),
('ffffffff-ffff-4fff-8fff-ffffffffffff','Digital Thermometer','ডিজিটাল থার্মোমিটার','SKU-6034',350,280,30,'pcs','Omron','1 pc','/products/digital-thermometer.jpg'),
('12121212-1212-4121-8121-121212121212','Cat Food 1kg','বিড়ালের খাবার ১ কেজি','SKU-6041',780,650,25,'pcs','Whiskas','1 kg','/products/cat-food-1kg.jpg'),
('12121212-1212-4121-8121-121212121212','Dog Food 1.5kg','কুকুরের খাবার ১.৫ কেজি','SKU-6042',950,800,20,'pcs','Pedigree','1.5 kg','/products/dog-food-1500g.jpg'),
('12121212-1212-4121-8121-121212121212','Cat Litter 5kg','ক্যাট লিটার ৫ কেজি','SKU-6043',890,740,18,'pcs','Kit Cat','5 kg','/products/cat-litter-5kg.jpg'),
('12121212-1212-4121-8121-121212121212','Pet Shampoo 200ml','পেট শ্যাম্পু ২০০ মিলি','SKU-6044',420,340,28,'pcs','Beaphar','200 ml','/products/pet-shampoo-200ml.jpg')
on conflict (sku) do nothing;