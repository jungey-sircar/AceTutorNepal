import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { api } from './_lib/api';
import { COLORS } from './_lib/theme';

export default function AdminPanel() {
  const [uniName, setUniName] = useState('');
  const [facName, setFacName] = useState('');
  const [facUniId, setFacUniId] = useState('');
  const [catTitle, setCatTitle] = useState('');
  const [pending, setPending] = useState<any>(null);

  useEffect(() => { loadPending(); }, []);

  async function loadPending() {
    try {
      const res = await api.get('/admin/pending-uploads');
      setPending(res);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to load pending uploads');
    }
  }

  async function createUniversity() {
    try {
      const res = await api.post('/admin/universities', { name: uniName });
      Alert.alert('Success', 'University created');
      setUniName('');
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed'); }
  }

  async function createFaculty() {
    try {
      const res = await api.post('/admin/faculties', { name: facName, university_id: facUniId });
      Alert.alert('Success', 'Faculty created');
      setFacName(''); setFacUniId('');
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed'); }
  }

  async function createCategory() {
    try {
      await api.post('/admin/categories', { title: catTitle });
      Alert.alert('Success', 'Category created');
      setCatTitle('');
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed'); }
  }

  async function approve(resource_type: string, id: string) {
    try {
      await api.post(`/admin/resources/${resource_type}/${id}/approve`);
      Alert.alert('Approved');
      loadPending();
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed'); }
  }

  async function feature(resource_type: string, id: string) {
    try {
      await api.post(`/admin/resources/${resource_type}/${id}/feature`, { featured: true });
      Alert.alert('Featured');
      loadPending();
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed'); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Admin Panel</Text>

        <Text style={styles.section}>Create University</Text>
        <View style={styles.row}>
          <TextInput style={styles.input} placeholder="University name" value={uniName} onChangeText={setUniName} />
          <TouchableOpacity style={styles.btn} onPress={createUniversity}><Text style={styles.btnText}>Create</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Create Faculty</Text>
        <View style={styles.row}>
          <TextInput style={styles.input} placeholder="Faculty name" value={facName} onChangeText={setFacName} />
          <TextInput style={[styles.input, {flex: 0.6}]} placeholder="University ID" value={facUniId} onChangeText={setFacUniId} />
          <TouchableOpacity style={styles.btn} onPress={createFaculty}><Text style={styles.btnText}>Create</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Create Category</Text>
        <View style={styles.row}>
          <TextInput style={styles.input} placeholder="Category title" value={catTitle} onChangeText={setCatTitle} />
          <TouchableOpacity style={styles.btn} onPress={createCategory}><Text style={styles.btnText}>Create</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Pending Uploads</Text>
        {pending ? (
          <View>
            {['papers','notes','videos','assignments'].map((k:any)=> (
              <View key={k} style={{marginBottom:12}}>
                <Text style={{fontWeight:'700'}}>{k.toUpperCase()} ({pending[k]?.length || 0})</Text>
                {pending[k]?.slice(0,6).map((item:any)=> (
                  <View key={item[Object.keys(item)[0]]} style={styles.pendingItem}>
                    <Text style={{flex:1}}>{item.title || item.name || JSON.stringify(item).slice(0,60)}</Text>
                    <TouchableOpacity style={styles.smallBtn} onPress={()=>approve(k.slice(0,-1), item[Object.keys(item)[0]])}><Text style={styles.smallBtnText}>Approve</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.smallBtn,{backgroundColor:COLORS.primary}]} onPress={()=>feature(k.slice(0,-1), item[Object.keys(item)[0]])}><Text style={[styles.smallBtnText,{color:'#fff'}]}>Feature</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <Text>Loading...</Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex:1, backgroundColor: '#fff'},
  scroll: {padding:16},
  title: {fontSize:20, fontWeight:'900', marginBottom:16},
  section: {fontSize:14, fontWeight:'800', marginTop:12, marginBottom:6},
  row: {flexDirection:'row', alignItems:'center', gap:8, marginBottom:8},
  input: {flex:1, borderWidth:1, borderColor:'#e5e7eb', padding:8, borderRadius:8, marginRight:8},
  btn: {backgroundColor: COLORS.primary, paddingHorizontal:12, paddingVertical:8, borderRadius:8},
  btnText: {color:'#fff', fontWeight:'700'},
  pendingItem: {flexDirection:'row', alignItems:'center', padding:8, borderWidth:1, borderColor:'#eee', borderRadius:8, marginTop:8},
  smallBtn: {paddingHorizontal:8, paddingVertical:6, borderRadius:6, borderWidth:1, borderColor:'#ddd', marginLeft:8},
  smallBtnText: {fontSize:12, fontWeight:'700'},
});

