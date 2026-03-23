import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from './services/api';
import { useAuthStore } from './services/store';

const SEVERITY_OPTIONS = [
  { value: 1, label: 'Minor', description: 'Small crack, minimal damage', color: '#4ade80' },
  { value: 2, label: 'Low', description: 'Shallow depression', color: '#a3e635' },
  { value: 3, label: 'Moderate', description: 'Visible hole, some depth', color: '#facc15' },
  { value: 4, label: 'High', description: 'Deep pothole, significant', color: '#f97316' },
  { value: 5, label: 'Critical', description: 'Major hazard, urgent attention', color: '#ef4444' },
];

export default function ReportScreen() {
  const params = useLocalSearchParams();
  const { token } = useAuthStore();
  
  const [severity, setSeverity] = useState(3);
  const [roadName, setRoadName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const latitude = parseFloat(params.lat as string) || 0;
  const longitude = parseFloat(params.lng as string) || 0;
  const autoDetected = params.autoDetected === 'true';

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert('Error', 'Please login first');
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        latitude,
        longitude,
        severity,
        road_name: roadName || undefined,
      };

      if (image) {
        data.image_base64 = image.replace('data:image/jpeg;base64,', '');
      }

      const result = await api.createPothole(data);
      
      if (result.id) {
        Alert.alert(
          'Success! 🎉',
          'Pothole reported successfully. Thank you for making roads safer!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to report pothole');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0a0a0f', '#1a1a24']} style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Report Pothole</Text>
          {autoDetected && (
            <View style={styles.autoBadge}>
              <Ionicons name="flash" size={14} color="#facc15" />
              <Text style={styles.autoBadgeText}>Auto-detected</Text>
            </View>
          )}
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationBox}>
            <Ionicons name="location" size={20} color="#888" />
            <Text style={styles.locationText}>
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity Level</Text>
          <Text style={styles.sectionSubtitle}>How severe is this pothole?</Text>
          
          <View style={styles.severityOptions}>
            {SEVERITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.severityOption,
                  severity === option.value && {
                    borderColor: option.color,
                    backgroundColor: `${option.color}20`,
                  },
                ]}
                onPress={() => setSeverity(option.value)}
              >
                <View style={[styles.severityDot, { backgroundColor: option.color }]} />
                <View style={styles.severityContent}>
                  <Text style={styles.severityLabel}>{option.label}</Text>
                  <Text style={styles.severityDescription}>{option.description}</Text>
                </View>
                {severity === option.value && (
                  <Ionicons name="checkmark-circle" size={24} color={option.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Photo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo (Optional)</Text>
          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={32} color="#888" />
                <Text style={styles.photoText}>Tap to take photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Road Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Road Name (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., MG Road, NH-48"
            placeholderTextColor="#666"
            value={roadName}
            onChangeText={setRoadName}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any additional information..."
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footer} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoBadgeText: {
    fontSize: 12,
    color: '#facc15',
    marginLeft: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    padding: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  severityOptions: {
    gap: 8,
  },
  severityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  severityContent: {
    flex: 1,
  },
  severityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  severityDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  photoButton: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a24',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#ff4444',
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  footer: {
    height: 40,
  },
});
