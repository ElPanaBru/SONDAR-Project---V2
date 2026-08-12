const USERS_KEY = "sondar_users";
const SESSION_KEY = "sondar_session";

const defaultUser = {
  uid: "default-jorge",
  email: "jorge@gmail.com",
  password: "123",
  displayName: "jorge",
};

function readUsers() {
  const storedUsers = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  const hasDefaultUser = storedUsers.some((user) => user.email === defaultUser.email);

  if (hasDefaultUser) return storedUsers;

  const users = [defaultUser, ...storedUsers];
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users;
}

function publicUser(user) {
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

function notifyAuthChange() {
  window.dispatchEvent(new Event("sondar-auth-change"));
}

export function getCurrentUser() {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  return publicUser(session);
}

export function login(email, password) {
  const users = readUsers();
  const user = users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
  );

  if (!user) {
    throw new Error("Email o contrasena incorrectos");
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
  notifyAuthChange();
  return publicUser(user);
}

export function register({ email, password, username }) {
  const users = readUsers();
  const exists = users.some((user) => user.email.toLowerCase() === email.toLowerCase());

  if (exists) {
    throw new Error("El correo ya esta registrado");
  }

  const user = {
    uid: crypto.randomUUID(),
    email,
    password,
    displayName: username || email.split("@")[0],
  };

  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
  notifyAuthChange();
  return publicUser(user);
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  notifyAuthChange();
}

export function subscribeToAuthChanges(callback) {
  const handleChange = () => callback(getCurrentUser());

  window.addEventListener("sondar-auth-change", handleChange);
  window.addEventListener("storage", handleChange);

  callback(getCurrentUser());

  return () => {
    window.removeEventListener("sondar-auth-change", handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
