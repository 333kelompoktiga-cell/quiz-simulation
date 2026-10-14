import { kirimTerautentikasi } from './auth'

export async function ambilDaftarPetaBelajar() {
  return (await kirimTerautentikasi('/peta-belajar', { method: 'GET' })).data
}

export async function ambilRoadmapBab(idBab) {
  return (await kirimTerautentikasi(`/peta-belajar/${encodeURIComponent(idBab)}`, { method: 'GET' })).data
}

export async function perbaruiRoadmapBab(idBab) {
  return (await kirimTerautentikasi(`/peta-belajar/${encodeURIComponent(idBab)}/regenerate`, { method: 'POST' })).data
}

