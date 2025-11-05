let routeUsage = false
let users: string[] = []

export function setUserUsage(userUsage: string) {
  users.push(userUsage)
}

export function getUserUsage(): string[] {
  return users
}

export function removeUserUsage(userUsage: string) {
  users = users.filter(user => user !== userUsage)
}
