import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

const CampaignContext = createContext();

export const useCampaigns = () => {
    const context = useContext(CampaignContext);
    if (!context) {
        throw new Error('useCampaigns must be used within a CampaignProvider');
    }
    return context;
};

export const CampaignProvider = ({ children }) => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "campanas"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const campaignsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCampaigns(campaignsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const addCampaign = async (newCampaign) => {
        try {
            const docRef = await addDoc(collection(db, "campanas"), {
                ...newCampaign,
                createdAt: new Date().toISOString().split('T')[0]
            });
            return docRef;
        } catch (error) {
            console.error("Error adding campaign: ", error);
            throw error;
        }
    };

    const updateCampaign = async (id, updatedData) => {
        try {
            const { doc, updateDoc } = await import('firebase/firestore');
            const campaignRef = doc(db, "campanas", id);
            await updateDoc(campaignRef, updatedData);
        } catch (error) {
            console.error("Error updating campaign: ", error);
            throw error;
        }
    };

    const deleteCampaign = async (id) => {
        try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const campaignRef = doc(db, "campanas", id);
            await deleteDoc(campaignRef);
        } catch (error) {
            console.error("Error deleting campaign: ", error);
            throw error;
        }
    };

    return (
        <CampaignContext.Provider value={{ campaigns, addCampaign, updateCampaign, deleteCampaign, loading }}>
            {children}
        </CampaignContext.Provider>
    );
};
