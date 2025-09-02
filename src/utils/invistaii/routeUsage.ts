let namesSellers: string[] = []
let imgSellers: string[] = []
let sellValue = 0

export function getNamesSellers() {
  return namesSellers
}

export function setNamesSellers(sellers: string[]) {
  namesSellers = sellers
}

export function getImgSellers() {
  return imgSellers
}

export function setImgSellers(img: string[]) {
  imgSellers = img
}

export function getSellValue() {
  return sellValue
}

export function setSellValue(value: number) {
  sellValue = value
}
