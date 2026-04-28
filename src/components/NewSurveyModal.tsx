import React from 'react';
import { SURVEY_TYPES } from '../constants';
import { X, MapPin, Calculator, Send, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError } from '../App';
import { OperationType } from '../types';
import { cn } from '../lib/utils';

export const NewSurveyModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [step, setStep] = React.useState(1);
  const [selectedType, setSelectedType] = React.useState(SURVEY_TYPES[0]);
  const [address, setAddress] = React.useState('');
  const [area, setArea] = React.useState<number>(100);
  const [notes, setNotes] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [referenceImages, setReferenceImages] = React.useState<string[]>([]);
  const [terrainDifficulty, setTerrainDifficulty] = React.useState<number>(1.0);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validateAddress = (val: string) => {
    if (!val) return 'Address is required';
    if (val.length < 10) return 'Please provide a more detailed address';
    return null;
  };

  const calculateTotalPrice = () => {
    const areaPrice = area * selectedType.pricePerM2;
    const baseWithArea = selectedType.basePrice + areaPrice;
    // Granular estimation: Complexity * Terrain Difficulty
    const subtotal = baseWithArea * selectedType.complexityFactor * terrainDifficulty;
    const fee = subtotal * 0.05;
    return {
      subtotal,
      fee,
      total: subtotal + fee
    };
  };

  const { subtotal, fee, total } = calculateTotalPrice();

  const handleNext = () => {
    setStep(2);
  };

  const handleSubmit = async () => {
    const addressError = validateAddress(address);
    if (addressError) {
      setErrors({ address: addressError });
      return;
    }

    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        clientId: auth.currentUser.uid,
        surveyTypeId: selectedType.id,
        status: 'pending',
        area: Number(area),
        complexity: selectedType.complexityFactor * terrainDifficulty,
        location: {
          address,
          lat: -6.2, // Mock coordinates
          lng: 106.8
        },
        notes,
        referenceImages,
        price: Number(total),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onClose();
      // Reset state
      setStep(1);
      setAddress('');
      setArea(100);
      setNotes('');
      setReferenceImages([]);
      setErrors({});
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold">New Survey Request</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-500">Pick a survey type</p>
                  <div className="grid grid-cols-1 gap-3">
                    {SURVEY_TYPES.map((type) => {
                      const TypeIcon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setSelectedType(type)}
                          className={`p-4 border rounded-xl text-left transition flex items-center gap-4 ${
                            selectedType.id === type.id 
                              ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" 
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                             <img 
                              src={type.imageUrl} 
                              className="w-full h-full object-cover" 
                              alt={type.name}
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-sm">{type.name}</p>
                            <p className="text-[10px] text-slate-500 leading-tight">{type.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-blue-600">{formatCurrency(type.basePrice)}</p>
                            <p className="text-[9px] text-slate-400 uppercase font-black">Starting</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={handleNext}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mt-6 hover:bg-blue-700 transition"
                  >
                    Next: Details
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Estimated Area (m&sup2;)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          value={area}
                          onChange={(e) => setArea(Number(e.target.value))}
                          className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none pr-12"
                        />
                        <span className="absolute right-4 top-3 text-slate-400">m&sup2;</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 font-black uppercase tracking-widest text-[10px]">Terrain Difficulty</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Flat', val: 1.0 },
                          { label: 'Hilly', val: 1.3 },
                          { label: 'Dense', val: 1.6 }
                        ].map(t => (
                          <button
                            key={t.label}
                            onClick={() => setTerrainDifficulty(t.val)}
                            className={cn(
                              "py-2.5 rounded-xl border font-bold text-xs transition",
                              terrainDifficulty === t.val ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Detailed Address</label>
                      <textarea 
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          if (errors.address) setErrors({ ...errors, address: '' });
                        }}
                        placeholder="e.g. Jl. Kemang Raya No. 10, Jakarta Selatan"
                        className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 ${
                          errors.address ? "border-red-400 ring-1 ring-red-400" : "border-slate-200"
                        }`}
                      />
                      {errors.address && (
                        <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                          <AlertCircle size={12} />
                          {errors.address}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Specific Requirements / Notes</label>
                      <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any specific instructions for the surveyor?"
                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Reference Images (URLs)</label>
                      <div className="flex gap-2 mb-2">
                        <input 
                          type="text"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="Paste image URL here"
                          className="flex-1 p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            if (imageUrl) {
                              setReferenceImages([...referenceImages, imageUrl]);
                              setImageUrl('');
                            }
                          }}
                          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
                        >
                          Add
                        </button>
                      </div>
                      {referenceImages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {referenceImages.map((img, i) => (
                            <div key={i} className="relative group">
                              <img src={img} alt="Ref" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                              <button 
                                onClick={() => setReferenceImages(referenceImages.filter((_, idx) => idx !== i))}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                              >
                                <X size={8} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                       <Calculator size={14} /> Price Breakdown
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Base Price</span>
                        <span>{formatCurrency(selectedType.basePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Area adjustment ({area} m&sup2;)</span>
                        <span>{formatCurrency(area * selectedType.pricePerM2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Complexity & Terrain</span>
                        <span className="bg-blue-100 text-blue-700 px-2 rounded-full text-[10px] font-bold">x {(selectedType.complexityFactor * terrainDifficulty).toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Service Fee (5%)</span>
                        <span className="text-slate-500">{formatCurrency(fee)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t-2 border-slate-200">
                        <span className="font-black text-slate-900">Final Estimate</span>
                        <span className="font-black text-blue-600 text-xl">
                          {formatCurrency(total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => setStep(1)}
                      className="flex-1 py-3 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleSubmit}
                      disabled={loading || !address}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? "Processing..." : (
                        <>
                          <Send size={18} />
                          Send Request
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

