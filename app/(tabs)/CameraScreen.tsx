import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import React, { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Image, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import AWS from 'aws-sdk';
import * as base64 from 'base64-js';
import credentials from '../../aws-credentials.json';



export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState(null);
  const cameraRef = useRef(null);
  const awsAccessKeyId = credentials.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = credentials.AWS_SECRET_ACCESS_KEY;
  

  const screenWidth = Dimensions.get('window').width;
  const cameraHeight = (screenWidth * 4) / 3; // Calculate height for 4:3 ratio

  // Configure AWS S3
  const s3 = new AWS.S3({
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
    region: 'us-east-2',
  });

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const uploadToS3 = async (fileUri) => {
    try {
      const file = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
      const byteArray = base64.toByteArray(file);
      const fileName = `photo_${Date.now()}.jpg`;
  
      const params = {
        Bucket: 'fixit-nish',
        Key: fileName,
        Body: byteArray,
        ContentType: 'image/jpeg',
      };
  
      const data = await s3.upload(params).promise();
      console.log('Successfully uploaded to S3:', data.Location);
    } catch (error) {
      console.error('Error uploading to S3:', error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          exif: true,
        });
        console.log('Photo captured:', photo.uri);

        const photoUri = `${FileSystem.documentDirectory}photo.jpg`;
        await FileSystem.moveAsync({
          from: photo.uri,
          to: photoUri,
        });

        console.log('Photo saved to:', photoUri);
        setCapturedImage(photoUri); // Set the captured image URI to state

        // Upload to S3
        await uploadToS3(photoUri);

      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri); // Set the picked image URI to state
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={{ ...styles.camera, height: cameraHeight }}
        facing={facing}
        ref={cameraRef}
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <Text style={styles.text}>Flip Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={takePicture}
          >
            <Text style={styles.text}>Capture Image</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={pickImage}
          >
            <Text style={styles.text}>Pick Image</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
      {capturedImage && (
        <Image
          source={{ uri: capturedImage }}
          style={{ width: screenWidth, height: cameraHeight, marginTop: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    width: '100%',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
