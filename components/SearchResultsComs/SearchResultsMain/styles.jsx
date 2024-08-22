import { StyleSheet, } from 'react-native'

const styles = StyleSheet.create({
    container:{
        flex:1,
    },
    bckBtn:{
        position:'absolute',
        top:25,
        left:10,
        height:35,
        width:35,
        borderRadius:10,
        backgroundColor:'#d8d3d3',
        zIndex:2,
        justifyContent:'center',
        alignItems:'center'
    },
    bckBtnIcon:{
        fontSize:30,
        color:'#6e6d6d',
    },
})

export default styles
