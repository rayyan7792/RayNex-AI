import { User, LanguageOption } from "../types";
import { STORAGE_KEYS } from "../constants";

// Simulates a delay to mimic network requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Internal mock DB helper
const getMockUsers = () => {
  const users = localStorage.getItem('raynex_mock_users_db');
  return users ? JSON.parse(users) : {};
};

const saveMockUsers = (users: any) => {
  localStorage.setItem('raynex_mock_users_db', JSON.stringify(users));
};

export const authService = {
  login: async (username: string, password: string): Promise<User> => {
    await delay(800); 
    
    const users = getMockUsers();
    const userRecord = users[username];

    // STRICT CHECK: User must exist in DB
    if (!userRecord) {
      throw new Error("Account does not exist. Please Sign Up.");
    }

    if (userRecord.password !== password) {
      throw new Error("Incorrect password");
    }

    const user: User = {
      username,
      token: `mock_jwt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      preferredLanguage: localStorage.getItem(STORAGE_KEYS.LANG_PREF) || 'en'
    };

    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, user.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    
    return user;
  },

  signup: async (username: string, password: string): Promise<User> => {
    await delay(1000);
    
    if (password.length < 12) {
      throw new Error("Password must be at least 12 characters long.");
    }

    const users = getMockUsers();
    if (users[username]) {
      throw new Error("Username already exists. Please choose another.");
    }

    // Save to mock DB
    users[username] = { password };
    saveMockUsers(users);
    
    const user: User = {
      username,
      token: `mock_jwt_${Date.now()}`,
      preferredLanguage: localStorage.getItem(STORAGE_KEYS.LANG_PREF) || 'en'
    };

    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, user.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));

    return user;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  },

  getSession: async (): Promise<User | null> => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);

    if (token && userData) {
      return JSON.parse(userData);
    }
    return null;
  },

  setLanguage: (langCode: string) => {
    localStorage.setItem(STORAGE_KEYS.LANG_PREF, langCode);
  },

  getLanguage: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.LANG_PREF);
  },

  // --- Profile Management ---

  updateProfile: async (currentUsername: string, newUsername: string): Promise<User> => {
    await delay(600);
    const users = getMockUsers();
    
    // If username changing, check availability
    if (newUsername !== currentUsername && users[newUsername]) {
      throw new Error("Username already taken");
    }

    // Migrate mock DB data
    if (users[currentUsername]) {
      users[newUsername] = users[currentUsername];
      delete users[currentUsername];
      saveMockUsers(users);
    }

    // Update Session
    const userDataStr = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    let updatedUser: User = userDataStr ? JSON.parse(userDataStr) : { username: newUsername, token: 'valid' };
    updatedUser.username = newUsername;

    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
    return updatedUser;
  },

  changePassword: async (username: string, oldPass: string, newPass: string) => {
    await delay(800);
    const users = getMockUsers();
    const userRecord = users[username];

    if (!userRecord) {
      // Should not happen with strict login, but as safeguard
      throw new Error("User record not found.");
    } else {
      if (userRecord.password !== oldPass) {
        throw new Error("Old password is incorrect");
      }
    }

    if (newPass.length < 12) {
      throw new Error("New password must be at least 12 characters");
    }

    // Update
    users[username] = { ...userRecord, password: newPass };
    saveMockUsers(users);
  },

  deleteAccount: async (username: string) => {
    await delay(1000);
    const users = getMockUsers();
    if (users[username]) {
      delete users[username];
      saveMockUsers(users);
    }
    // Clear all local data
    localStorage.clear();
  }
};