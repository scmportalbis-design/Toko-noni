-- Reset password pengguna oleh pemilik (tombol "Reset password" di menu Pengguna).
-- Frontend memanggil fungsi ini lewat supabase.rpc(); tidak butuh service-role key.
-- Hanya pemilik aktif yang lolos is_owner(). Password disimpan sebagai hash bcrypt
-- (format yang sama dengan Supabase Auth) dan TIDAK pernah ditulis ke audit_log.

create or replace function public.owner_reset_user_password(p_user_id uuid, p_new_password text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_rows int;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'PENGGUNA_TIDAK_DITEMUKAN'; end if;
  if p_user_id = auth.uid() then raise exception 'TIDAK_BISA_RESET_AKUN_SENDIRI'; end if;
  -- bcrypt hanya membaca 72 byte pertama, jadi batasi di 72 byte.
  if p_new_password is null
     or char_length(p_new_password) < 8
     or octet_length(p_new_password) > 72 then
    raise exception 'PASSWORD_TIDAK_VALID';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'PENGGUNA_TIDAK_DITEMUKAN';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'PENGGUNA_TIDAK_DITEMUKAN'; end if;

  -- Paksa keluar dari semua perangkat agar sesi lama tidak tetap berlaku.
  delete from auth.sessions where user_id = p_user_id;

  perform public._audit('user.password_reset', 'user', p_user_id::text, null);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.owner_reset_user_password(uuid, text) from public, anon;
grant execute on function public.owner_reset_user_password(uuid, text) to authenticated;
