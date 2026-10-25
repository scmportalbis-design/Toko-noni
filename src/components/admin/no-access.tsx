import { signOut } from "@/app/admin/login/actions";

// Tampil bila akun berhasil login tetapi tidak punya profil staf aktif.
export function NoAccess({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Akun tidak punya akses</h1>
        <p className="text-sm text-slate-600">
          {email ?? "Akun ini"} belum terdaftar sebagai pemilik atau kasir Toko Noni, atau sudah
          dinonaktifkan. Hubungi pemilik toko.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Keluar
          </button>
        </form>
      </div>
    </div>
  );
}
