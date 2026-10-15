import { ROLE } from '../config/roles.js';

export const KOLOM_AKSES_KUIS = 'idKuis, idUser, aksesKelola, dosenPengelola';

export const bisaAturAkses = (kuis, user) => user?.role === ROLE.ADMIN
  && (kuis.idUser === null || kuis.idUser === user.id);

export const bisaDikelola = (kuis, user) => user?.role === ROLE.ADMIN && (
  bisaAturAkses(kuis, user)
  || kuis.aksesKelola === 'semua'
  || (kuis.aksesKelola === 'tertentu' && (kuis.dosenPengelola ?? []).includes(user.id))
);
