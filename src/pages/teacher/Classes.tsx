/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Edit3, Users, GraduationCap, AlertCircle } from 'lucide-react';
import { Button, Card, Modal, Table, Badge } from '../../components/UIComponents';
import { classService } from '../../services/api';
import { ClassGroup } from '../../types';
import { formatPersianNumber } from '../../services/persianHelpers';

export default function Classes() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [formData, setFormData] = useState({ name: '', grade: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await classService.getClassGroups();
      setClasses(data);
    } catch (err) {
      setError('خطا در بارگذاری گروه‌های کلاسی.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cls?: ClassGroup) => {
    if (cls) {
      setEditingClass(cls);
      setFormData({ name: cls.name, grade: cls.grade });
    } else {
      setEditingClass(null);
      setFormData({ name: '', grade: '' });
    }
    setIsModalOpen(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.grade) {
      setError('لطفاً تمامی فیلدها را پر کنید.');
      return;
    }

    try {
      if (editingClass) {
        await classService.updateClassGroup(editingClass.id, formData.name, formData.grade);
      } else {
        await classService.createClassGroup(formData.name, formData.grade);
      }
      setIsModalOpen(false);
      await loadClasses();
    } catch (err) {
      setError('خطایی در ذخیره‌سازی رخ داد.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('آیا از حذف این کلاس و تمامی ارتباطات آن با دانش‌آموزان مطمئن هستید؟')) return;
    try {
      await classService.deleteClassGroup(id);
      await loadClasses();
    } catch (err) {
      setError('خطا در حذف کلاس.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">مدیریت گروه‌های کلاسی</h1>
          <p className="text-sm text-slate-500 mt-1">سازماندهی دانش‌آموزان بر اساس پایه و کلاس</p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          variant="primary"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن کلاس جدید</span>
        </Button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <Table
            headers={[
              { key: 'name', label: 'نام کلاس' },
              { key: 'grade', label: 'پایه تحصیلی' },
              { key: 'count', label: 'تعداد دانش‌آموزان', align: 'center' },
              { key: 'actions', label: 'عملیات', align: 'center' },
            ]}
            data={classes}
            renderRow={(cls) => (
              <tr key={cls.id} className="hover:bg-slate-50 transition-colors text-xs md:text-sm">
                <td className="p-4 font-bold text-slate-700">{cls.name}</td>
                <td className="p-4">
                  <Badge variant="slate" className="bg-slate-100 text-slate-600">{cls.grade}</Badge>
                </td>
                <td className="p-4 text-center font-mono text-slate-600">
                  {formatPersianNumber(cls.studentCount)} نفر
                </td>
                <td className="p-4 flex items-center justify-center gap-2">
                  <Button
                    onClick={() => handleOpenModal(cls)}
                    variant="ghost"
                    size="sm"
                    className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(cls.id)}
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            )}
            renderMobileCard={(cls) => (
              <Card key={cls.id} className="p-4 space-y-3 border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800">{cls.name}</h4>
                    <p className="text-[11px] text-slate-500">پایه {cls.grade}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                    {formatPersianNumber(cls.studentCount)} دانش‌آموز
                  </span>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                  <Button onClick={() => handleOpenModal(cls)} variant="ghost" size="sm">ویرایش</Button>
                  <Button onClick={() => handleDelete(cls.id)} variant="danger" size="sm">حذف</Button>
                </div>
              </Card>
            )}
          />
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClass ? 'ویرایش اطلاعات کلاس' : 'افزودن کلاس جدید'}
      >
        <div className="space-y-4 text-right" dir="rtl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">نام کلاس / گروه</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="مثلاً کلاس ۷۰۱ یا گروه پیشرفته نهم"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">پایه تحصیلی</label>
            <select
              value={formData.grade}
              onChange={(e) => setFormData({...formData, grade: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="">انتخاب پایه...</option>
              <optgroup label="دبستان">
                <option value="اول">اول</option>
                <option value="دوم">دوم</option>
                <option value="سوم">سوم</option>
                <option value="چهارم">چهارم</option>
                <option value="پنجم">پنجم</option>
                <option value="ششم">ششم</option>
              </optgroup>
              <optgroup label="دوره اول متوسطه">
                <option value="هفتم">هفتم</option>
                <option value="هشتم">هشتم</option>
                <option value="نهم">نهم</option>
              </optgroup>
              <optgroup label="دوره دوم متوسطه">
                <option value="دهم">دهم</option>
                <option value="یازدهم">یازدهم</option>
                <option value="دوازدهم">دوازدهم</option>
              </optgroup>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button onClick={() => setIsModalOpen(false)} variant="ghost">انصراف</Button>
            <Button onClick={handleSave} variant="primary">ذخیره تغییرات</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
