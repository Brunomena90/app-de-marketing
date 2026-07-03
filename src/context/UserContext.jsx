import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

const UserContext = createContext();

export const useUsers = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUsers must be used within a UserProvider');
    }
    return context;
};

export const UserProvider = ({ children }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "users"), orderBy("name"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const addUser = async (newUser) => {
        try {
            await addDoc(collection(db, "users"), {
                ...newUser,
                createdAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error adding user: ", error);
            throw error;
        }
    };

    const updateUser = async (id, updatedUser) => {
        try {
            const userRef = doc(db, "users", id);
            await updateDoc(userRef, updatedUser);
        } catch (error) {
            console.error("Error updating user: ", error);
            throw error;
        }
    };

    const deleteUser = async (id) => {
        try {
            const userRef = doc(db, "users", id);
            await deleteDoc(userRef);
        } catch (error) {
            console.error("Error deleting user: ", error);
            throw error;
        }
    };

    return (
        <UserContext.Provider value={{ users, addUser, updateUser, deleteUser, loading }}>
            {children}
        </UserContext.Provider>
    );
};
