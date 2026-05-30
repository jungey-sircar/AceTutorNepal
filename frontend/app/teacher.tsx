import React, { useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from './_lib/api';
import { COLORS } from './_lib/theme';

export default function TeacherPanel(){
  const [title, setTitle] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [year, setYear] = useState('');
  const [notesContent, setNotesContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  async function pickFile(){
    try{
      const res = await DocumentPicker.getDocumentAsync({type: '*/*'});
      if(res.type === 'success'){
        setSelectedFile(res);
      }
    }catch(e:any){
      Alert.alert('Error', e.message || 'Failed to pick file');
    }
  }

  async function uploadToS3AndCreateNote(){
    if(!selectedFile){ Alert.alert('No file selected'); return; }
    setUploading(true);
    try{
      const fileName = selectedFile.name || 'upload.bin';
      const contentType = selectedFile.mimeType || 'application/octet-stream';

      // Request presigned URL from backend
      const query = `?file_name=${encodeURIComponent(fileName)}&content_type=${encodeURIComponent(contentType)}`;
      const presignRes = await api.get(`/uploads/signed-url${query}` as any);

      const uploadUrl = presignRes.upload_url;
      const objectKey = presignRes.object_key;
      const publicUrl = presignRes.public_url || null;

      // Read file as blob via fetch on the file URI
      const fileUri = selectedFile.uri;
      const fileResp = await fetch(fileUri);
      const fileBlob = await fileResp.blob();

      // PUT the file to S3
      const putResp = await fetch(uploadUrl, { method: 'PUT', headers: {'Content-Type': contentType}, body: fileBlob });
      if(!putResp.ok){
        throw new Error(`Upload failed: ${putResp.status}`);
      }

      // Register completed upload with backend to get canonical URL
      const completeResp = await api.post('/uploads/complete', {
        object_key: objectKey,
        public_url: publicUrl,
        file_name: fileName,
        content_type: contentType
      });

      const pdf_url_to_store = completeResp.url || completeResp.object_key;

      // Create note resource pointing to uploaded file
      const notePayload = {
        node_id: nodeId,
        title,
        content: notesContent,
        pdf_url: pdf_url_to_store
      };
      const createRes = await api.post('/teacher/notes', notePayload);
      Alert.alert('Success', 'Note uploaded and submitted for review');
      // reset
      setTitle(''); setNodeId(''); setNotesContent(''); setSelectedFile(null);
    }catch(e:any){
      console.error(e);
      Alert.alert('Upload error', e.message || 'Upload failed');
    }finally{
      setUploading(false);
    }
  }

  async function uploadFileAndCreatePaper(){
    if(!selectedFile){ Alert.alert('No file selected'); return; }
    setUploading(true);
    try{
      const fileName = selectedFile.name || 'upload.bin';
      const contentType = selectedFile.mimeType || 'application/octet-stream';
      const query = `?file_name=${encodeURIComponent(fileName)}&content_type=${encodeURIComponent(contentType)}`;
      const presignRes = await api.get(`/uploads/signed-url${query}` as any);
      const uploadUrl = presignRes.upload_url;
      const objectKey = presignRes.object_key;
      const publicUrl = presignRes.public_url || null;

      const fileUri = selectedFile.uri;
      const fileResp = await fetch(fileUri);
      const fileBlob = await fileResp.blob();

      const putResp = await fetch(uploadUrl, { method: 'PUT', headers: {'Content-Type': contentType}, body: fileBlob });
      if(!putResp.ok) throw new Error(`Upload failed: ${putResp.status}`);

      const completeResp = await api.post('/uploads/complete', {
        object_key: objectKey,
        public_url: publicUrl,
        file_name: fileName,
        content_type: contentType
      });

      const pdf_url_to_store = completeResp.url || completeResp.object_key;
      const paperPayload = { node_id: nodeId, title, year: parseInt(year || '0', 10), pdf_url: pdf_url_to_store };
      const createRes = await api.post('/teacher/papers', paperPayload);
      Alert.alert('Success','Paper uploaded for review');
      setTitle(''); setNodeId(''); setYear(''); setSelectedFile(null);
    }catch(e:any){ Alert.alert('Error', e.message || 'Failed'); }
    finally{ setUploading(false); }
  }

  async function createAssignment(){
    try{
      await api.post('/teacher/assignments', { node_id: nodeId, title, description: notesContent, file_url: selectedFile?.name || null });
      Alert.alert('Success','Assignment created');
      setTitle(''); setNodeId(''); setNotesContent(''); setSelectedFile(null);
    }catch(err:any){ Alert.alert('Error', err.message || 'Failed'); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Teacher Panel</Text>

        <Text style={styles.section}>Select File to Upload</Text>
        <View style={{flexDirection:'row', gap:8, marginBottom:8}}>
          <TouchableOpacity style={styles.btn} onPress={pickFile}><Text style={styles.btnText}>Pick File</Text></TouchableOpacity>
          <View style={{flex:1, justifyContent:'center'}}>
            <Text numberOfLines={1} style={{color:COLORS.textSecondary}}>{selectedFile?.name || 'No file selected'}</Text>
          </View>
        </View>

        <Text style={styles.section}>Upload Note (with file)</Text>
        <TextInput style={styles.input} placeholder="Node ID (subject)" value={nodeId} onChangeText={setNodeId} />
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input,{height:120}]} placeholder="Content / Notes" value={notesContent} onChangeText={setNotesContent} multiline />
        <TouchableOpacity style={styles.btn} onPress={uploadToS3AndCreateNote} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Upload Note</Text>}
        </TouchableOpacity>

        <Text style={styles.section}>Upload Paper (with file)</Text>
        <TextInput style={styles.input} placeholder="Node ID" value={nodeId} onChangeText={setNodeId} />
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="Year" value={year} onChangeText={setYear} keyboardType="numeric" />
        <TouchableOpacity style={styles.btn} onPress={uploadFileAndCreatePaper} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Upload Paper</Text>}
        </TouchableOpacity>

        <Text style={styles.section}>Create Assignment</Text>
        <TextInput style={styles.input} placeholder="Node ID" value={nodeId} onChangeText={setNodeId} />
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input,{height:120}]} placeholder="Description / Instructions" value={notesContent} onChangeText={setNotesContent} multiline />
        <TouchableOpacity style={styles.btn} onPress={createAssignment}><Text style={styles.btnText}>Create Assignment</Text></TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1, backgroundColor:'#fff'},
  scroll:{padding:16},
  title:{fontSize:20, fontWeight:'900', marginBottom:16},
  section:{fontSize:14, fontWeight:'800', marginTop:12, marginBottom:6},
  input:{borderWidth:1, borderColor:'#e5e7eb', padding:8, borderRadius:8, marginBottom:8},
  btn:{backgroundColor:COLORS.primary, padding:12, borderRadius:8, alignItems:'center', marginBottom:12},
  btnText:{color:'#fff', fontWeight:'800'}
});

