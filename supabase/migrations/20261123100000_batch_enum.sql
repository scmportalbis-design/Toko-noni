-- Batch stok, langkah 1 dari 3: tipe pergerakan stok baru 'write_off' (pembuangan batch).
-- Jalankan PERTAMA dan terpisah (nilai enum baru baru bisa dipakai setelah perintah ini selesai).
-- Aman dijalankan ulang.
alter type public.stock_movement_type add value if not exists 'write_off';
